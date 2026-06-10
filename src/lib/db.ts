import Dexie, { type Table } from 'dexie'
import type { Action, DrillMode, FocusRequest, HandCategory, SpotSeed } from './spot'
import { RFI_POSITIONS, type Position, type RfiPosition } from '../data/ranges'

// One row per decision the player makes. Offline-first; all local.
export interface DecisionRecord {
  id?: number
  ts: number
  mode: DrillMode
  /** Grouping key: position for preflop, board for postflop. */
  context: string
  position: Position
  label: string
  category: HandCategory
  chosen: Action
  correct: Action
  isCorrect: boolean
}

/** A spot the player misplayed, queued for spaced review. */
export interface MistakeRecord {
  key: string // seedKey, unique per spot identity
  seed: SpotSeed
  ts: number
  misses: number
}

class LeakDB extends Dexie {
  decisions!: Table<DecisionRecord, number>
  mistakes!: Table<MistakeRecord, string>

  constructor() {
    super('leak-tutor')
    this.version(1).stores({
      decisions: '++id, ts, position, category, isCorrect',
    })
    // v2: tag each decision with its drill mode + a grouping context so
    // postflop stats no longer collapse into the BTN preflop bucket.
    this.version(2)
      .stores({ decisions: '++id, ts, mode, context, position, category, isCorrect' })
      .upgrade(async (tx) => {
        await tx
          .table('decisions')
          .toCollection()
          .modify((d: DecisionRecord) => {
            d.mode ??= 'rfi'
            d.context ??= d.position
          })
      })
    // v3: review queue of misplayed spots.
    this.version(3).stores({ mistakes: 'key, ts, misses' })
  }
}

export const db = new LeakDB()

export async function logDecision(rec: Omit<DecisionRecord, 'id'>): Promise<void> {
  await db.decisions.add(rec)
}

// ---- review queue (spaced repetition) --------------------------------------

export async function enqueueMistake(key: string, seed: SpotSeed): Promise<void> {
  const existing = await db.mistakes.get(key)
  await db.mistakes.put({ key, seed, ts: Date.now(), misses: (existing?.misses ?? 0) + 1 })
}

export async function retireMistake(key: string): Promise<void> {
  await db.mistakes.delete(key)
}

export async function touchMistake(key: string): Promise<void> {
  const existing = await db.mistakes.get(key)
  if (existing) await db.mistakes.put({ ...existing, ts: Date.now() })
}

export async function dueMistakes(limit = 50): Promise<MistakeRecord[]> {
  return db.mistakes.orderBy('ts').limit(limit).toArray()
}

export async function mistakeCount(): Promise<number> {
  return db.mistakes.count()
}

export interface LeakStat {
  key: string
  attempts: number
  errors: number
  errorRate: number
}

function aggregateBy(rows: DecisionRecord[], pick: (d: DecisionRecord) => string): LeakStat[] {
  const map = new Map<string, { attempts: number; errors: number }>()
  for (const d of rows) {
    const key = pick(d)
    const cur = map.get(key) ?? { attempts: 0, errors: 0 }
    cur.attempts++
    if (!d.isCorrect) cur.errors++
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v, errorRate: v.attempts ? v.errors / v.attempts : 0 }))
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts)
}

export interface ModeStats {
  total: number
  correct: number
  accuracy: number
  byContext: LeakStat[]
  byCategory: LeakStat[]
}

function modeStats(rows: DecisionRecord[]): ModeStats {
  const total = rows.length
  const correct = rows.filter((d) => d.isCorrect).length
  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    byContext: aggregateBy(rows, (d) => d.context ?? d.position),
    byCategory: aggregateBy(rows, (d) => d.category),
  }
}

/** A top leak, plus how to fix it: a targeted drill, a matching lesson, and
 *  whether it's closing (recent error rate vs earlier). */
export interface TopLeak extends LeakStat {
  drill?: FocusRequest
  /** Id of a lesson that teaches this leak, when one fits. */
  lessonId?: string
  /** Direction of the error rate over time. */
  trend?: 'improving' | 'flat' | 'worse'
}

export interface LeakSummary {
  total: number
  correct: number
  accuracy: number
  preflop: ModeStats
  postflop: ModeStats
  /** Top leaks across everything, with enough samples and a real error rate. */
  topLeaks: TopLeak[]
}

const RFI_SET = new Set<string>(RFI_POSITIONS)
/** Drill a leaky hand type by biasing the deal toward that category. */
const catDrill = (cat: string, mode: DrillMode): FocusRequest => ({ mode, cats: [cat as HandCategory], label: cat })
/** Drill a leaky seat by pinning RFI to that position (only seats that open). */
const posDrill = (pos: string): FocusRequest | undefined =>
  RFI_SET.has(pos) ? { mode: 'rfi', lockPos: pos as RfiPosition, label: `${pos} opens` } : undefined

/** A position leak maps to the lesson that teaches that seat. */
const POS_LESSON: Record<string, string> = {
  BTN: 'rfi-btn',
  CO: 'rfi-co',
  UTG: 'rfi-utg',
  SB: 'rfi-sb',
  BB: 'vsrfi-bb',
}

/** Is this leak closing? Compare the error rate of the recent half to the early half. */
function leakTrend(rows: DecisionRecord[]): TopLeak['trend'] {
  if (rows.length < 8) return undefined
  const sorted = [...rows].sort((a, b) => a.ts - b.ts)
  const half = Math.floor(sorted.length / 2)
  const er = (arr: DecisionRecord[]) => (arr.length ? arr.filter((d) => !d.isCorrect).length / arr.length : 0)
  const early = er(sorted.slice(0, half))
  const recent = er(sorted.slice(half))
  if (recent <= early - 0.12) return 'improving'
  if (recent >= early + 0.12) return 'worse'
  return 'flat'
}

export async function getLeakSummary(): Promise<LeakSummary> {
  const all = await db.decisions.toArray()
  const pre = all.filter((d) => (d.mode ?? 'rfi') !== 'postflop')
  const post = all.filter((d) => d.mode === 'postflop')
  const total = all.length
  const correct = all.filter((d) => d.isCorrect).length

  const preStats = modeStats(pre)
  const postStats = modeStats(post)

  const topLeaks: TopLeak[] = [
    ...preStats.byCategory.map((s) => ({
      ...s,
      key: `${s.key} (preflop)`,
      drill: catDrill(s.key, 'rfi'),
      trend: leakTrend(pre.filter((d) => d.category === s.key)),
    })),
    ...preStats.byContext.map((s) => ({
      ...s,
      key: `${s.key} (preflop)`,
      drill: posDrill(s.key),
      lessonId: POS_LESSON[s.key],
      trend: leakTrend(pre.filter((d) => (d.context ?? d.position) === s.key)),
    })),
    ...postStats.byCategory.map((s) => ({
      ...s,
      key: `${s.key} (postflop)`,
      drill: catDrill(s.key, 'postflop'),
      lessonId: 'postflop',
      trend: leakTrend(post.filter((d) => d.category === s.key)),
    })),
  ]
    .filter((s) => s.attempts >= 4 && s.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts)
    .slice(0, 3)

  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    preflop: preStats,
    postflop: postStats,
    topLeaks,
  }
}

export async function resetProgress(): Promise<void> {
  await db.decisions.clear()
}

/** Hand categories the player misplays most (for adaptive 'focus' drilling). */
export async function weakCategories(): Promise<HandCategory[]> {
  const all = await db.decisions.toArray()
  const cats = aggregateBy(all, (d) => d.category)
  return cats.filter((c) => c.attempts >= 3 && c.errorRate > 0).map((c) => c.key as HandCategory)
}

export interface ProgressBucket {
  accuracy: number
  count: number
}
export interface ProgressTrend {
  buckets: ProgressBucket[]
  /** accuracy of the most recent third minus the earliest third (signed) */
  delta: number
  recentAccuracy: number
}

/** Accuracy over time, in up to `n` chronological buckets (for a sparkline). */
export async function progressTrend(n = 12): Promise<ProgressTrend | null> {
  const all = (await db.decisions.toArray()).sort((a, b) => a.ts - b.ts)
  if (all.length < 10) return null
  const size = Math.ceil(all.length / n)
  const buckets: ProgressBucket[] = []
  for (let i = 0; i < all.length; i += size) {
    const slice = all.slice(i, i + size)
    const correct = slice.filter((d) => d.isCorrect).length
    buckets.push({ accuracy: correct / slice.length, count: slice.length })
  }
  const third = Math.max(1, Math.floor(buckets.length / 3))
  const avg = (b: ProgressBucket[]) => (b.length ? b.reduce((s, x) => s + x.accuracy, 0) / b.length : 0)
  const early = avg(buckets.slice(0, third))
  const late = avg(buckets.slice(-third))
  return { buckets, delta: late - early, recentAccuracy: buckets[buckets.length - 1].accuracy }
}
