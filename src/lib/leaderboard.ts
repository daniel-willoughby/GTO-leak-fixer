// Public leaderboards built on the `profiles` (all-time, by PP earned) and
// `daily_scores` (today's ladder) tables. Each user publishes a shareable
// summary that everyone can read. Dormant until Supabase is configured.
import { supabase, supabaseConfigured } from './supabase'
import { equipped, earnedPoints, grantDailyWin, hasClaimedDailyWin } from './points'
import { dayKey, prevDay } from './daily'
import type { SyncSnapshot } from './sync'

export interface LeaderRow {
  user_id: string
  handle: string
  hands_played: number
  best_streak: number
  accuracy: number
  pp_earned: number
  avatar: string
  flair: string
}

export interface DailyRow {
  user_id: string
  day: string
  score: number
  time_ms: number
  handle: string
  avatar: string
  flair: string
}

const HANDLE_KEY = 'lt-handle'
export const getHandle = (): string => localStorage.getItem(HANDLE_KEY) ?? ''
export const setHandle = (h: string): void => localStorage.setItem(HANDLE_KEY, h.trim().slice(0, 24))
const displayName = (userId: string): string => getHandle() || `Player ${userId.slice(0, 4)}`

function longestRun(flags: boolean[]): number {
  let best = 0
  let cur = 0
  for (const ok of flags) {
    cur = ok ? cur + 1 : 0
    if (cur > best) best = cur
  }
  return best
}

/** Headline stats derived from a sync snapshot (the public-safe summary). */
export function profileStats(snap: SyncSnapshot): Pick<LeaderRow, 'hands_played' | 'best_streak' | 'accuracy'> {
  const d = snap.decisions
  const total = d.length
  const correct = d.filter((x) => x.isCorrect).length
  const byTime = [...d].sort((a, b) => a.ts - b.ts).map((x) => x.isCorrect)
  return {
    hands_played: total,
    best_streak: longestRun(byTime),
    accuracy: total ? Math.round((correct / total) * 100) : 0,
  }
}

/** Publish this user's profile row (called after a sync). No-op when offline. */
export async function upsertProfile(userId: string, snap: SyncSnapshot): Promise<void> {
  if (!supabase) return
  const eq = equipped()
  await supabase.from('profiles').upsert({
    user_id: userId,
    handle: displayName(userId),
    ...profileStats(snap),
    pp_earned: await earnedPoints(),
    avatar: eq.avatar,
    flair: eq.flair,
    updated_at: new Date().toISOString(),
  })
}

/** All-time leaderboard: top players by total Poker Points earned. */
export async function fetchAllTimeLeaderboard(limit = 50): Promise<LeaderRow[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,handle,hands_played,best_streak,accuracy,pp_earned,avatar,flair')
    .order('pp_earned', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as LeaderRow[]
}

/** Back-compat alias used by older callers (streak board → all-time board). */
export const fetchLeaderboard = fetchAllTimeLeaderboard

// ---- daily leaderboard -----------------------------------------------------

/** Publish today's ladder score (denormalised cosmetics for cheap render). */
export async function submitDailyScore(userId: string, day: string, score: number, timeMs: number): Promise<void> {
  if (!supabase) return
  const eq = equipped()
  await supabase.from('daily_scores').upsert(
    {
      user_id: userId,
      day,
      score,
      time_ms: timeMs,
      handle: displayName(userId),
      avatar: eq.avatar,
      flair: eq.flair,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,day' },
  )
}

/** Today's daily leaderboard: best score first, faster time breaks ties. */
export async function fetchDailyLeaderboard(day: string = dayKey(), limit = 50): Promise<DailyRow[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('daily_scores')
    .select('user_id,day,score,time_ms,handle,avatar,flair')
    .eq('day', day)
    .order('score', { ascending: false })
    .order('time_ms', { ascending: true })
    .limit(limit)
  if (error || !data) return []
  return data as DailyRow[]
}

/**
 * If you topped yesterday's daily board and haven't been paid yet, grant the
 * daily-winner bonus. Client-claimed (offline-first); returns true if granted.
 */
export async function claimDailyWinIfTop(userId: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false
  const yesterday = prevDay(dayKey())
  if (hasClaimedDailyWin(yesterday)) return false
  const rows = await fetchDailyLeaderboard(yesterday, 1)
  if (rows.length && rows[0].user_id === userId) return grantDailyWin(yesterday)
  return false
}
