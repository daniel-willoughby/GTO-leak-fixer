// Public leaderboard built on the `profiles` table. Each user publishes a
// shareable summary (handle + headline stats) that everyone can read, so the
// Achievements tab can rank players. Dormant until Supabase is configured.
import { supabase, supabaseConfigured } from './supabase'
import type { SyncSnapshot } from './sync'

export interface LeaderRow {
  user_id: string
  handle: string
  hands_played: number
  best_streak: number
  accuracy: number
}

const HANDLE_KEY = 'lt-handle'
export const getHandle = (): string => localStorage.getItem(HANDLE_KEY) ?? ''
export const setHandle = (h: string): void => localStorage.setItem(HANDLE_KEY, h.trim().slice(0, 24))

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
  const handle = getHandle() || `Player ${userId.slice(0, 4)}`
  await supabase
    .from('profiles')
    .upsert({ user_id: userId, handle, ...profileStats(snap), updated_at: new Date().toISOString() })
}

/** Top players by best streak, then accuracy. Empty when sync isn't set up. */
export async function fetchLeaderboard(limit = 25): Promise<LeaderRow[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,handle,hands_played,best_streak,accuracy')
    .gte('hands_played', 1)
    .order('best_streak', { ascending: false })
    .order('accuracy', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as LeaderRow[]
}
