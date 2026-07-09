// Head-to-head duels: two players play the *same* 10 seeded spots, optionally
// for a Poker Points wager. Both clients derive the identical 10 questions from
// the duel's seed (seeded RNG, like the daily ladder), so it's a fair contest.
//
// Two flavours:
//   • a direct challenge to a friend (opponent set up front), and
//   • an *open* duel anyone can accept (opponent null until someone claims it).
//
// The challenger creates the row already holding their score; the opponent
// plays and submits theirs, which closes the duel. Wager settlement is
// client-honored for now (integrity-signed PP), to be made server-authoritative
// via the publish-standings Edge Function later.

import { supabase, supabaseConfigured } from './supabase'
import { equipped, settleDuel, type DuelOutcome } from './points'
import { mulberry32, hashStr } from './rng'
import { generateSpot, seedOf, type SpotSeed, type DrillMode, type Difficulty } from './spot'

export const DUEL_LEN = 10

export type DuelStatus = 'open' | 'pending' | 'done' | 'declined'

export interface DuelRow {
  id: string
  challenger: string
  challenger_handle: string
  challenger_avatar: string
  /** null while an open duel is unclaimed. */
  opponent: string | null
  opponent_handle: string | null
  opponent_avatar: string | null
  wager: number
  seed: string
  status: DuelStatus
  challenger_score: number | null
  challenger_time: number | null
  opponent_score: number | null
  opponent_time: number | null
  created_at: string
  /** When the duel concluded (second player submitted). Null until 'done';
   *  backfilled from created_at for duels finished before this column existed. */
  concluded_at: string | null
}

const myHandle = () => localStorage.getItem('lt-handle') || 'Player'

// A brisk 10-spot mix: a few opens, some vs-a-raise, a squeeze, two postflop.
const DUEL_PLAN: { mode: DrillMode; difficulty: Difficulty }[] = [
  { mode: 'rfi', difficulty: 'easy' },
  { mode: 'rfi', difficulty: 'all' },
  { mode: 'rfi', difficulty: 'all' },
  { mode: 'vsRfi', difficulty: 'all' },
  { mode: 'vsRfi', difficulty: 'all' },
  { mode: 'vsRfi', difficulty: 'hard' },
  { mode: 'multiway', difficulty: 'all' },
  { mode: 'postflop', difficulty: 'all' },
  { mode: 'postflop', difficulty: 'all' },
  { mode: 'postflop', difficulty: 'hard' },
]

function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  Math.random = mulberry32(seed)
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}

/** The 10 spots for a duel, identical on both players' devices. */
export function duelSeeds(seed: string): SpotSeed[] {
  return withSeededRandom(hashStr(`duel-${seed}`), () =>
    DUEL_PLAN.map((r) => seedOf(generateSpot(r.mode, { difficulty: r.difficulty }))),
  )
}

/** A fresh random seed for a new duel. */
export const newDuelSeed = (): string => Math.random().toString(36).slice(2, 10)

/** Create a direct challenge to a friend, already holding the challenger's
 *  score. The opponent is set up front; status starts 'pending'. */
export async function createDuel(p: {
  userId: string
  opponentId: string
  opponentHandle: string
  opponentAvatar: string
  wager: number
  seed: string
  score: number
  timeMs: number
}): Promise<DuelRow | null> {
  if (!supabase) return null
  const eq = equipped()
  const { data, error } = await supabase
    .from('duels')
    .insert({
      challenger: p.userId,
      challenger_handle: myHandle(),
      challenger_avatar: eq.avatar,
      opponent: p.opponentId,
      opponent_handle: p.opponentHandle,
      opponent_avatar: p.opponentAvatar,
      wager: Math.max(0, Math.floor(p.wager)),
      seed: p.seed,
      status: 'pending',
      challenger_score: p.score,
      challenger_time: p.timeMs,
    })
    .select()
    .single()
  if (error) {
    console.error('[duel] createDuel failed:', error.message)
    return null
  }
  return data as DuelRow
}

/** Create an *open* duel anyone can accept. Opponent is left null until claimed.
 *  The challenger's score is held already, exactly like a direct challenge. */
export async function createOpenDuel(p: {
  userId: string
  wager: number
  seed: string
  score: number
  timeMs: number
}): Promise<DuelRow | null> {
  if (!supabase) return null
  const eq = equipped()
  const { data, error } = await supabase
    .from('duels')
    .insert({
      challenger: p.userId,
      challenger_handle: myHandle(),
      challenger_avatar: eq.avatar,
      opponent: null,
      wager: Math.max(0, Math.floor(p.wager)),
      seed: p.seed,
      status: 'open',
      challenger_score: p.score,
      challenger_time: p.timeMs,
    })
    .select()
    .single()
  if (error) {
    console.error('[duel] createOpenDuel failed:', error.message)
    return null
  }
  return data as DuelRow
}

/** A friend submits their score to a direct challenge, closing it. The status
 *  guard makes the write a no-op if the duel was already answered (so a double
 *  submit can't reopen or overwrite a finished duel). */
export async function answerDuel(duelId: string, score: number, timeMs: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('duels')
    .update({ opponent_score: score, opponent_time: timeMs, status: 'done', concluded_at: new Date().toISOString() })
    .eq('id', duelId)
    .eq('status', 'pending')
  if (error) console.error('[duel] answerDuel failed:', error.message)
}

/** Claim and play an open duel: stamp yourself as the opponent and submit your
 *  score atomically. The `status='open'` guard ensures only the *first* claimer
 *  wins the race, a second accept finds the row already 'done' and no-ops.
 *  Returns true if this client successfully claimed it. */
export async function acceptOpenDuel(duelId: string, userId: string, score: number, timeMs: number): Promise<boolean> {
  if (!supabase) return false
  const eq = equipped()
  const { data, error } = await supabase
    .from('duels')
    .update({
      opponent: userId,
      opponent_handle: myHandle(),
      opponent_avatar: eq.avatar,
      opponent_score: score,
      opponent_time: timeMs,
      status: 'done',
      concluded_at: new Date().toISOString(),
    })
    .eq('id', duelId)
    .eq('status', 'open')
    .select()
  if (error) {
    console.error('[duel] acceptOpenDuel failed:', error.message)
    return false
  }
  return !!data && data.length > 0
}

export async function declineDuel(duelId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('duels').update({ status: 'declined' }).eq('id', duelId)
}

/** Every duel this user is part of, most recent first. */
export async function fetchDuels(userId: string): Promise<DuelRow[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(`challenger.eq.${userId},opponent.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data as DuelRow[]
}

/** Open duels posted by *other* players that this user can accept. */
export async function fetchOpenDuels(userId: string): Promise<DuelRow[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .neq('challenger', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error || !data) return []
  return (data as DuelRow[]).filter((d) => !hasPlayed(d.id))
}

export type LedgerSort = 'recent' | 'wager'

/** Public ledger: concluded duels across *all* players, ordered by when they
 *  concluded (most recently finished first) or by the biggest pot. Rows finished
 *  before `concluded_at` existed were backfilled from created_at, but guard with
 *  a client fallback in case any slipped through. */
export async function fetchPublicLedger(sort: LedgerSort = 'recent', limit = 25): Promise<DuelRow[]> {
  if (!supabaseConfigured || !supabase) return []
  let q = supabase.from('duels').select('*').eq('status', 'done')
  q =
    sort === 'wager'
      ? q.order('wager', { ascending: false }).order('concluded_at', { ascending: false, nullsFirst: false })
      : q.order('concluded_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  const { data, error } = await q.limit(limit)
  if (error || !data) return []
  return data as DuelRow[]
}

/** Completion time of a duel for display/sort, falling back to when it was
 *  created for rows that predate the concluded_at column. */
export const duelConcludedAt = (d: DuelRow): string => d.concluded_at ?? d.created_at

/** Who won, from this user's perspective. Higher score wins; an equal score is
 *  broken by the faster total answer time. Only an exact tie on both score and
 *  time is a push (no PP changes hands). */
export function duelOutcome(d: DuelRow, userId: string): DuelOutcome {
  const side = duelWinnerSide(d)
  if (!side) return 'push'
  const winner = side === 'challenger' ? d.challenger : d.opponent
  return winner === userId ? 'win' : 'loss'
}

/** Who won, by side ('challenger' | 'opponent' | null for an exact tie), for the
 *  public ledger, which has no single viewer. Score first, faster time breaks a
 *  drawn score. */
export function duelWinnerSide(d: DuelRow): 'challenger' | 'opponent' | null {
  const cs = d.challenger_score ?? 0
  const os = d.opponent_score ?? 0
  if (cs !== os) return cs > os ? 'challenger' : 'opponent'
  const ct = d.challenger_time ?? Infinity
  const ot = d.opponent_time ?? Infinity
  if (ct === ot) return null // identical score and time: a genuine push
  return ct < ot ? 'challenger' : 'opponent'
}

/** Apply the wager outcome for any finished, unsettled duels. Idempotent (each
 *  duel settles once per device). Returns how many were newly settled. */
export function settleFinishedDuels(userId: string, duels: DuelRow[]): number {
  let settled = 0
  for (const d of duels) {
    if (d.status !== 'done') continue
    if (d.challenger !== userId && d.opponent !== userId) continue
    const o = duelOutcome(d, userId)
    const delta = o === 'win' ? d.wager : o === 'loss' ? -d.wager : 0
    if (settleDuel(d.id, delta, o)) settled++
  }
  return settled
}

/** Incoming direct challenges awaiting this user's response (not yet played). */
export const incomingDuels = (duels: DuelRow[], userId: string): DuelRow[] =>
  duels.filter((d) => d.opponent === userId && d.status === 'pending' && !hasPlayed(d.id))

// ---- "already played" guard ------------------------------------------------
// The server write that closes a duel is async; without a local marker the same
// pending/open duel can briefly reappear in a refetch and be played twice. We
// mark a duel the moment its run starts, so it leaves the inbox immediately and
// stays gone across refetch races.
const PLAYED_KEY = 'lt-duel-played'
const playedSet = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
export const hasPlayed = (id: string): boolean => playedSet().has(id)
export function markDuelPlayed(id: string): void {
  const s = playedSet()
  if (s.has(id)) return
  s.add(id)
  localStorage.setItem(PLAYED_KEY, JSON.stringify([...s]))
}

// ---- conclusion notifications ----------------------------------------------
// When a duel you're in finishes (the other player submitted their score), you
// should be told the result, even if you're not on the Duels tab. We track
// which finished duels you've already been shown. First run seeds silently so a
// returning player with a backlog of done duels isn't flooded with pops.
const SEEN_KEY = 'lt-duel-seen'

/** Finished duels involving this user that they haven't been notified about. */
export function unseenConclusions(userId: string, duels: DuelRow[]): DuelRow[] {
  const done = duels.filter(
    (d) => d.status === 'done' && (d.challenger === userId || d.opponent === userId),
  )
  const raw = localStorage.getItem(SEEN_KEY)
  if (raw === null) {
    localStorage.setItem(SEEN_KEY, JSON.stringify(done.map((d) => d.id)))
    return []
  }
  let seen: string[] = []
  try {
    seen = JSON.parse(raw) as string[]
  } catch {
    seen = []
  }
  const seenSet = new Set(seen)
  return done.filter((d) => !seenSet.has(d.id))
}

export function markConclusionsSeen(ids: string[]): void {
  if (!ids.length) return
  let seen: string[] = []
  const raw = localStorage.getItem(SEEN_KEY)
  if (raw) {
    try {
      seen = JSON.parse(raw) as string[]
    } catch {
      seen = []
    }
  }
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...ids])]))
}
