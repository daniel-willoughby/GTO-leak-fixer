// Offline-first snapshot sync. Local stays the source of truth; on sync we union
// the local and remote snapshots (so nothing is lost across devices) and write the
// merged result both back to the device and up to Supabase.
import { supabase } from './supabase'
import {
  exportDecisions,
  exportMistakes,
  replaceDecisions,
  replaceMistakes,
  type DecisionRecord,
  type MistakeRecord,
} from './db'
import type { DailyState } from './daily'
import type { LessonState } from './level'

type LessonMap = Record<string, LessonState>

export interface SyncSnapshot {
  v: 1
  updatedAt: number
  decisions: DecisionRecord[]
  mistakes: MistakeRecord[]
  daily: DailyState | null
  lessons: LessonMap | null
  level: string | null
  difficulty: string | null
}

const TABLE = 'user_state'
const lsParse = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
const lsWrite = (k: string, v: unknown) =>
  v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v))

export async function gatherLocal(): Promise<SyncSnapshot> {
  return {
    v: 1,
    updatedAt: Date.now(),
    decisions: await exportDecisions(),
    mistakes: await exportMistakes(),
    daily: lsParse<DailyState>('lt-daily'),
    lessons: lsParse<LessonMap>('lt-lessons'),
    level: localStorage.getItem('lt-level'),
    difficulty: localStorage.getItem('lt-difficulty'),
  }
}

export async function applySnapshot(snap: SyncSnapshot): Promise<void> {
  await replaceDecisions(snap.decisions)
  await replaceMistakes(snap.mistakes)
  lsWrite('lt-daily', snap.daily)
  lsWrite('lt-lessons', snap.lessons)
  if (snap.level) localStorage.setItem('lt-level', snap.level)
  if (snap.difficulty) localStorage.setItem('lt-difficulty', snap.difficulty)
}

// ---- merge ----------------------------------------------------------------

const decSig = (d: DecisionRecord) => `${d.ts}|${d.mode}|${d.context}|${d.label}|${d.chosen}|${d.correct}`

function mergeDecisions(a: DecisionRecord[], b: DecisionRecord[]): DecisionRecord[] {
  const seen = new Set<string>()
  const out: DecisionRecord[] = []
  for (const d of [...a, ...b]) {
    const k = decSig(d)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ ...d, id: undefined })
  }
  return out.sort((x, y) => x.ts - y.ts)
}

function mergeMistakes(a: MistakeRecord[], b: MistakeRecord[]): MistakeRecord[] {
  const map = new Map<string, MistakeRecord>()
  for (const m of [...a, ...b]) {
    const cur = map.get(m.key)
    if (!cur) map.set(m.key, m)
    else map.set(m.key, { ...m, misses: Math.max(cur.misses, m.misses), ts: Math.max(cur.ts, m.ts) })
  }
  return [...map.values()]
}

function mergeDaily(a: DailyState | null, b: DailyState | null): DailyState | null {
  if (!a) return b
  if (!b) return a
  const best = Math.max(a.best, b.best)
  // whichever run was active more recently owns the current streak fields
  const newer = (a.lastDone || a.date) >= (b.lastDone || b.date) ? a : b
  return { ...newer, best }
}

function mergeLessons(a: LessonMap | null, b: LessonMap | null): LessonMap | null {
  if (!a) return b
  if (!b) return a
  const out: LessonMap = { ...a }
  for (const [id, s] of Object.entries(b)) {
    const cur = out[id]
    out[id] = cur ? { correct: Math.max(cur.correct, s.correct), done: cur.done || s.done } : s
  }
  return out
}

export function mergeSnapshots(a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot {
  const newer = a.updatedAt >= b.updatedAt ? a : b
  return {
    v: 1,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    decisions: mergeDecisions(a.decisions, b.decisions),
    mistakes: mergeMistakes(a.mistakes, b.mistakes),
    daily: mergeDaily(a.daily, b.daily),
    lessons: mergeLessons(a.lessons, b.lessons),
    level: newer.level ?? a.level ?? b.level,
    difficulty: newer.difficulty ?? a.difficulty ?? b.difficulty,
  }
}

// ---- remote ---------------------------------------------------------------

async function pullRemote(): Promise<SyncSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('data').maybeSingle()
  if (error || !data) return null
  return data.data as SyncSnapshot
}

async function pushRemote(userId: string, snap: SyncSnapshot): Promise<void> {
  if (!supabase) return
  await supabase.from(TABLE).upsert({ user_id: userId, data: snap, updated_at: new Date().toISOString() })
}

/** Pull remote, union with local, write merged everywhere. Returns the merge. */
export async function syncNow(userId: string): Promise<SyncSnapshot> {
  const local = await gatherLocal()
  const remote = await pullRemote()
  const merged = remote ? mergeSnapshots(local, remote) : local
  if (remote) await applySnapshot(merged)
  await pushRemote(userId, merged)
  return merged
}

/** Push only — used for debounced background saves after local changes. */
export async function pushLocal(userId: string): Promise<void> {
  await pushRemote(userId, await gatherLocal())
}
