// Head-to-head duels: two friends play the *same* 10 seeded spots, optionally
// for a Poker Points wager. Both clients derive the identical 10 questions from
// the duel's seed (seeded RNG, like the daily ladder), so it's a fair contest.
// Wager settlement is client-honored for now (integrity-signed PP), to be made
// server-authoritative via the publish-standings Edge Function later.

import { supabase, supabaseConfigured } from './supabase'
import { equipped, settleDuel } from './points'
import { mulberry32, hashStr } from './rng'
import { generateSpot, seedOf, type SpotSeed, type DrillMode, type Difficulty } from './spot'

export const DUEL_LEN = 10

export interface DuelRow {
  id: string
  challenger: string
  challenger_handle: string
  challenger_avatar: string
  opponent: string
  opponent_handle: string
  opponent_avatar: string
  wager: number
  seed: string
  status: 'pending' | 'done' | 'declined'
  challenger_score: number | null
  challenger_time: number | null
  opponent_score: number | null
  opponent_time: number | null
  created_at: string
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

/** The 10 spots for a duel — identical on both players' devices. */
export function duelSeeds(seed: string): SpotSeed[] {
  return withSeededRandom(hashStr(`duel-${seed}`), () =>
    DUEL_PLAN.map((r) => seedOf(generateSpot(r.mode, { difficulty: r.difficulty }))),
  )
}

/** A fresh random seed for a new duel. */
export const newDuelSeed = (): string => Math.random().toString(36).slice(2, 10)

/** Create a duel, already holding the challenger's score. Returns the row. */
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

/** Opponent submits their score, which closes the duel. */
export async function answerDuel(duelId: string, score: number, timeMs: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('duels')
    .update({ opponent_score: score, opponent_time: timeMs, status: 'done' })
    .eq('id', duelId)
  if (error) console.error('[duel] answerDuel failed:', error.message)
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

/** Who won, from this user's perspective (ties broken by faster time). */
export function duelOutcome(d: DuelRow, userId: string): 'win' | 'loss' | 'push' {
  const cs = d.challenger_score ?? 0
  const os = d.opponent_score ?? 0
  let winner: string | null
  if (cs !== os) {
    winner = cs > os ? d.challenger : d.opponent
  } else {
    const ct = d.challenger_time ?? Infinity
    const ot = d.opponent_time ?? Infinity
    winner = ct === ot ? null : ct < ot ? d.challenger : d.opponent
  }
  if (!winner) return 'push'
  return winner === userId ? 'win' : 'loss'
}

/** Apply the wager outcome for any finished, unsettled duels. Idempotent (each
 *  duel settles once per device). Returns how many were newly settled. */
export function settleFinishedDuels(userId: string, duels: DuelRow[]): number {
  let settled = 0
  for (const d of duels) {
    if (d.status !== 'done') continue
    const o = duelOutcome(d, userId)
    const delta = o === 'win' ? d.wager : o === 'loss' ? -d.wager : 0
    if (settleDuel(d.id, delta)) settled++
  }
  return settled
}

/** Incoming challenges awaiting this user's response (they haven't played yet). */
export const incomingDuels = (duels: DuelRow[], userId: string): DuelRow[] =>
  duels.filter((d) => d.opponent === userId && d.status === 'pending')
