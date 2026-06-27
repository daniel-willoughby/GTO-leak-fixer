// Offline-first snapshot sync. Local stays the source of truth; on sync we union
// the local and remote snapshots (so nothing is lost across devices) and write the
// merged result both back to the device and up to Supabase.
import { supabase } from './supabase'
import {
  exportDecisions,
  exportMistakes,
  replaceDecisions,
  replaceMistakes,
  dropRapidDupes,
  type DecisionRecord,
  type MistakeRecord,
} from './db'
import type { DailyState } from './daily'
import type { LessonState } from './level'
import { signEconomyState, type Equipped, type DailyResult } from './points'
import { upsertProfile, syncDailyScores } from './leaderboard'

type LessonMap = Record<string, LessonState>
type DailyResults = Record<string, DailyResult>

export interface SyncSnapshot {
  v: 1
  updatedAt: number
  decisions: DecisionRecord[]
  mistakes: MistakeRecord[]
  daily: DailyState | null
  lessons: LessonMap | null
  level: string | null
  difficulty: string | null
  // game layer: cosmetics, purchases, daily ladder results, identity, friends
  owned?: string[] | null
  equipped?: Equipped | null
  dailyResults?: DailyResults | null
  dailyWins?: string[] | null
  bonuses?: string[] | null
  duelLedger?: Record<string, number> | null
  handle?: string | null
  friends?: string[] | null
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
    owned: lsParse<string[]>('lt-owned'),
    equipped: lsParse<Equipped>('lt-equip'),
    dailyResults: lsParse<DailyResults>('lt-daily-results'),
    dailyWins: lsParse<string[]>('lt-daily-wins'),
    bonuses: lsParse<string[]>('lt-bonus'),
    duelLedger: lsParse<Record<string, number>>('lt-duel-ledger'),
    handle: localStorage.getItem('lt-handle'),
    friends: lsParse<string[]>('lt-friends'),
  }
}

export async function applySnapshot(snap: SyncSnapshot): Promise<void> {
  await replaceDecisions(snap.decisions)
  await replaceMistakes(snap.mistakes)
  lsWrite('lt-daily', snap.daily)
  lsWrite('lt-lessons', snap.lessons)
  if (snap.level) localStorage.setItem('lt-level', snap.level)
  if (snap.difficulty) localStorage.setItem('lt-difficulty', snap.difficulty)
  if (snap.owned) lsWrite('lt-owned', snap.owned)
  if (snap.equipped) lsWrite('lt-equip', snap.equipped)
  if (snap.dailyResults) lsWrite('lt-daily-results', snap.dailyResults)
  if (snap.dailyWins) lsWrite('lt-daily-wins', snap.dailyWins)
  if (snap.bonuses) lsWrite('lt-bonus', snap.bonuses)
  if (snap.duelLedger) lsWrite('lt-duel-ledger', snap.duelLedger)
  signEconomyState() // re-sign the merged economy keys so they pass the load-time check
  if (snap.handle) localStorage.setItem('lt-handle', snap.handle)
  if (snap.friends) lsWrite('lt-friends', snap.friends)
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
  // also collapse rapid-fire double-logs (a few ms apart, so the exact-content
  // dedup above misses them) so they can't accumulate across device syncs
  return dropRapidDupes(out.sort((x, y) => x.ts - y.ts))
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

function mergeOwned(a?: string[] | null, b?: string[] | null): string[] | null {
  if (!a && !b) return null
  return [...new Set([...(a ?? []), ...(b ?? [])])]
}

function mergeDailyResults(a?: DailyResults | null, b?: DailyResults | null): DailyResults | null {
  if (!a) return b ?? null
  if (!b) return a
  const out: DailyResults = { ...a }
  for (const [day, r] of Object.entries(b)) {
    const cur = out[day]
    out[day] =
      !cur || r.score > cur.score || (r.score === cur.score && r.timeMs < cur.timeMs) ? r : cur
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
    owned: mergeOwned(a.owned, b.owned),
    equipped: newer.equipped ?? a.equipped ?? b.equipped ?? null,
    dailyResults: mergeDailyResults(a.dailyResults, b.dailyResults),
    dailyWins: mergeOwned(a.dailyWins, b.dailyWins),
    bonuses: mergeOwned(a.bonuses, b.bonuses),
    // union of per-duel deltas; a given duel id resolves to the same delta on
    // both devices, so a plain merge is correct
    duelLedger: a.duelLedger || b.duelLedger ? { ...(a.duelLedger ?? {}), ...(b.duelLedger ?? {}) } : null,
    handle: (newer.handle || a.handle || b.handle) ?? null,
    friends: mergeOwned(a.friends, b.friends),
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
  await upsertProfile(userId, merged) // publish the public leaderboard row
  await syncDailyScores(userId)       // retroactively submit any pre-sign-in ladder results
  return merged
}

// Cheap signature of the synced state (everything except the wall-clock
// `updatedAt`). Lets a debounced push bail out when nothing actually changed.
let lastPushSig = ''
function snapSig(s: SyncSnapshot): string {
  const d = s.decisions
  return [
    d.length,
    d.length ? d[d.length - 1].ts : 0,
    s.mistakes.length,
    JSON.stringify(s.owned),
    JSON.stringify(s.equipped),
    JSON.stringify(s.dailyResults),
    JSON.stringify(s.dailyWins),
    JSON.stringify(s.bonuses),
    JSON.stringify(s.duelLedger),
    JSON.stringify(s.friends),
    s.handle,
    s.level,
    s.difficulty,
  ].join('|')
}

/** Push only, used for debounced background saves after local changes. */
export async function pushLocal(userId: string): Promise<void> {
  const snap = await gatherLocal()
  const sig = snapSig(snap)
  if (sig === lastPushSig) return // nothing changed since the last push — skip all 3 writes
  lastPushSig = sig
  await pushRemote(userId, snap)
  await upsertProfile(userId, snap)
  await syncDailyScores(userId)
}
