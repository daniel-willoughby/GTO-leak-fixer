import Dexie, { type Table } from 'dexie'
import type { Action, DrillMode, HandCategory } from './spot'
import type { Position } from '../data/ranges'

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

class LeakDB extends Dexie {
  decisions!: Table<DecisionRecord, number>

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
  }
}

export const db = new LeakDB()

export async function logDecision(rec: Omit<DecisionRecord, 'id'>): Promise<void> {
  await db.decisions.add(rec)
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

export interface LeakSummary {
  total: number
  correct: number
  accuracy: number
  preflop: ModeStats
  postflop: ModeStats
  /** Top leaks across everything, with enough samples and a real error rate. */
  topLeaks: LeakStat[]
}

export async function getLeakSummary(): Promise<LeakSummary> {
  const all = await db.decisions.toArray()
  const pre = all.filter((d) => (d.mode ?? 'rfi') !== 'postflop')
  const post = all.filter((d) => d.mode === 'postflop')
  const total = all.length
  const correct = all.filter((d) => d.isCorrect).length

  const preStats = modeStats(pre)
  const postStats = modeStats(post)

  const tagged = (stats: LeakStat[], suffix: string) => stats.map((s) => ({ ...s, key: `${s.key} ${suffix}` }))
  const topLeaks = [
    ...preStats.byCategory.map((s) => ({ ...s, key: `${s.key} (preflop)` })),
    ...tagged(preStats.byContext, '(preflop)'),
    ...postStats.byCategory.map((s) => ({ ...s, key: `${s.key} (postflop)` })),
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
