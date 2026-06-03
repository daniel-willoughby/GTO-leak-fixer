import Dexie, { type Table } from 'dexie'
import type { Action, HandCategory } from './spot'
import type { Position } from '../data/ranges'

// One row per decision the player makes. Offline-first; all local.
export interface DecisionRecord {
  id?: number
  ts: number
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
      // indexed fields for fast leak aggregation
      decisions: '++id, ts, position, category, isCorrect',
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

async function aggregate(field: 'position' | 'category'): Promise<LeakStat[]> {
  const all = await db.decisions.toArray()
  const map = new Map<string, { attempts: number; errors: number }>()
  for (const d of all) {
    const key = d[field]
    const cur = map.get(key) ?? { attempts: 0, errors: 0 }
    cur.attempts++
    if (!d.isCorrect) cur.errors++
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v, errorRate: v.attempts ? v.errors / v.attempts : 0 }))
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts)
}

export interface LeakSummary {
  total: number
  correct: number
  accuracy: number
  byPosition: LeakStat[]
  byCategory: LeakStat[]
  /** Top leaks: categories/positions with enough samples and high error rate. */
  topLeaks: LeakStat[]
}

export async function getLeakSummary(): Promise<LeakSummary> {
  const all = await db.decisions.toArray()
  const total = all.length
  const correct = all.filter((d) => d.isCorrect).length
  const byPosition = await aggregate('position')
  const byCategory = await aggregate('category')

  const topLeaks = [...byCategory, ...byPosition.map((p) => ({ ...p, key: `${p.key} (position)` }))]
    .filter((s) => s.attempts >= 4 && s.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts)
    .slice(0, 3)

  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    byPosition,
    byCategory,
    topLeaks,
  }
}

export async function resetProgress(): Promise<void> {
  await db.decisions.clear()
}
