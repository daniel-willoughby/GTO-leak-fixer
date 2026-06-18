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
  /** Postflop only: leaks bucketed by flop texture (dry / wet / paired …). */
  byTexture?: LeakStat[]
  /** Postflop only: how you fare when the right move is bet / check / fold … */
  byDecision?: LeakStat[]
}

const RANK_VAL: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
}

/** Bucket a flop into a readable texture: the noisy per-board breakdown collapses
 *  into a handful of teachable groups that map onto the board-texture lesson. */
export function boardTextureLabel(board: string): string {
  const cards = board.match(/../g) ?? []
  if (cards.length < 3) return 'Other'
  const flop = cards.slice(0, 3)
  const ranks = flop.map((c) => RANK_VAL[c[0].toUpperCase()] ?? 0).sort((a, b) => b - a)
  const suits = flop.map((c) => c[1].toLowerCase())
  const paired = new Set(ranks).size < 3
  const suitCounts = suits.reduce<Record<string, number>>((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {})
  const maxSuit = Math.max(...Object.values(suitCounts))
  const span = ranks[0] - ranks[2]
  const highCard = ranks[0]
  if (paired) return 'Paired'
  if (maxSuit === 3) return 'Monotone'
  if (span <= 4) return 'Connected' // straight-heavy, the wettest unpaired boards
  if (maxSuit === 2) return 'Two-tone' // a flush draw present, otherwise dry
  if (highCard >= 12) return 'High & dry' // A/K/Q-high rainbow, the c-bet sweet spot
  return 'Low & dry'
}

/** A friendly "when the solver wants X" bucket, so a player sees whether they
 *  over-check, over-fold, or misvalue their bets, not just a board string. */
export function decisionLabel(correct: Action): string {
  switch (correct) {
    case 'bet':
    case 'bet33':
    case 'bet75':
      return 'When you should bet'
    case 'check':
      return 'When you should check'
    case 'fold':
      return 'When you should fold'
    case 'call':
      return 'When you should call'
    case 'raise':
    case '3bet':
    case 'squeeze':
    case 'cold-4bet':
      return 'When you should raise'
    default:
      return 'Other'
  }
}

function modeStats(rows: DecisionRecord[], postflop = false): ModeStats {
  const total = rows.length
  const correct = rows.filter((d) => d.isCorrect).length
  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    byContext: aggregateBy(rows, (d) => d.context ?? d.position),
    byCategory: aggregateBy(rows, (d) => d.category),
    ...(postflop && {
      byTexture: aggregateBy(rows, (d) => boardTextureLabel(d.context ?? '')),
      byDecision: aggregateBy(rows, (d) => decisionLabel(d.correct)),
    }),
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
  /** One-line "here's the fix" so the report teaches, not just measures. */
  coach?: string
}

/** Short, actionable fix per leak category / seat, the teaching layer of the
 *  report, so a user learns the principle without opening a full lesson. */
const COACH: Record<string, string> = {
  // seats (preflop opening discipline)
  BTN: 'On the button you can open almost half your hands, fold the true junk, but stealing wide is where your edge is.',
  CO: 'From the cutoff, open a wide but disciplined range; you still have the button and blinds left to act.',
  HJ: 'From the hijack, open a solid range but lean tighter than the cutoff, more players can wake up behind you.',
  UTG: 'Up front, tighten up: big pairs, broadways, and the best suited hands. When unsure, fold.',
  SB: "From the small blind, raise or fold, never limp. You'll be out of position, so the weakest hands go.",
  BB: 'In the big blind you get a price to defend wide vs a raise, but still fold the bottom and 3-bet your best.',
  // hand categories
  'Pocket pair': 'Pairs play for set value and showdown, open the big ones for value, fold the smallest out of position.',
  'Suited ace': "Suited aces carry nut-flush and blocker value, they open and 3-bet well, so don't over-fold them.",
  'Offsuit ace': 'Offsuit aces are easily dominated, they need position; fold the weak ones from early seats.',
  'Suited broadway': 'Two big suited cards flop strong top pairs and draws, play them aggressively, respect early position.',
  'Offsuit broadway': 'Good high-card value, weaker playability, open them later and fold them earlier than the suited version.',
  'Suited connector': 'Suited connectors realise equity in position, continue more in position, let them go out of position.',
  'Suited gapper': 'One-gap suited hands are speculative, keep them when you have position and a cheap price.',
  'Suited other': 'Speculative suited hands lean on flush equity and position; do not overplay them.',
  'Offsuit other': 'Offsuit, disconnected hands flop poorly, when in doubt, fold.',
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
  const postStats = modeStats(post, true)

  const topLeaks: TopLeak[] = [
    ...preStats.byCategory.map((s) => ({
      ...s,
      key: `${s.key} (preflop)`,
      drill: catDrill(s.key, 'rfi'),
      coach: COACH[s.key],
      trend: leakTrend(pre.filter((d) => d.category === s.key)),
    })),
    ...preStats.byContext.map((s) => ({
      ...s,
      key: `${s.key} (preflop)`,
      drill: posDrill(s.key),
      lessonId: POS_LESSON[s.key],
      coach: COACH[s.key],
      trend: leakTrend(pre.filter((d) => (d.context ?? d.position) === s.key)),
    })),
    ...postStats.byCategory.map((s) => ({
      ...s,
      key: `${s.key} (postflop)`,
      drill: catDrill(s.key, 'postflop'),
      lessonId: 'postflop',
      coach: COACH[s.key],
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
  // a full reset: the decision log AND the queued-mistake review pile
  await db.decisions.clear()
  await db.mistakes.clear()
}

// ---- cloud-sync export / import --------------------------------------------

export async function exportDecisions(): Promise<DecisionRecord[]> {
  return db.decisions.toArray()
}
export async function exportMistakes(): Promise<MistakeRecord[]> {
  return db.mistakes.toArray()
}
/** Replace the local decision log (ids are device-local, so they're dropped). */
export async function replaceDecisions(rows: DecisionRecord[]): Promise<void> {
  await db.decisions.clear()
  await db.decisions.bulkAdd(rows.map((r) => ({ ...r, id: undefined })))
}
export async function replaceMistakes(rows: MistakeRecord[]): Promise<void> {
  await db.mistakes.clear()
  await db.mistakes.bulkPut(rows)
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
