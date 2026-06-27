// Public leaderboards built on the `profiles` (all-time, by PP earned) and
// `daily_scores` (today's ladder) tables. Each user publishes a shareable
// summary that everyone can read. Dormant until Supabase is configured.
import { supabase, supabaseConfigured } from './supabase'
import { equipped, earnedPoints, grantDailyWin, hasClaimedDailyWin, dailyWinsClaimed, dailyResults, type DailyResult } from './points'
import { dayKey, prevDay } from './daily'
import type { SyncSnapshot } from './sync'

export interface LeaderRow {
  user_id: string
  handle: string
  hands_played: number
  best_streak: number
  accuracy: number
  /** Accuracy split by street (percent); -1 when there are no hands yet. */
  pre_acc: number
  post_acc: number
  pp_earned: number
  /** Times this player topped the daily ladder at reset (daily-win crowns). */
  crowns: number
  avatar: string
  flair: string
  /** Equipped background id, used to tint this player's leaderboard row. */
  background: string
}

const COLS = 'user_id,handle,hands_played,best_streak,accuracy,pre_acc,post_acc,pp_earned,crowns,avatar,flair,background'

export interface DailyRow {
  user_id: string
  day: string
  score: number
  time_ms: number
  handle: string
  avatar: string
  flair: string
  background: string
}

// Short-lived in-memory cache for leaderboard reads so flipping between the
// Daily / All-time / Friends tabs (or a re-render) doesn't refetch every time.
// Busted whenever we publish a write, so a fresh score shows up immediately.
const READ_TTL = 30_000
const readCache = new Map<string, { t: number; data: unknown }>()
async function cachedRead<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = readCache.get(key)
  if (hit && Date.now() - hit.t < READ_TTL) return hit.data as T
  const data = await fn()
  readCache.set(key, { t: Date.now(), data })
  return data
}
const bustLeaderboardCache = () => readCache.clear()

const HANDLE_KEY = 'lt-handle'

/**
 * Strip emoji / pictographs from a username, leaving plain text. Keeps letters,
 * digits, spaces and punctuation; removes pictographic emoji, flag pairs, skin
 * tones and the zero-width joiner / variation selectors that compose them.
 * `\p{Extended_Pictographic}` excludes ASCII alphanumerics, so digits survive.
 */
export function sanitizeHandle(raw: string): string {
  return raw
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // regional-indicator flag letters
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '') // skin-tone modifiers
    .replace(/[‍︎️⃣]/g, '') // ZWJ, VS15/16, keycap combiner
    .replace(/\s{2,}/g, ' ')
    .slice(0, 24)
}

export const getHandle = (): string => localStorage.getItem(HANDLE_KEY) ?? ''
export const setHandle = (h: string): void =>
  localStorage.setItem(HANDLE_KEY, sanitizeHandle(h).trim())
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

/** Accuracy (percent) over a set of decisions; -1 when the set is empty. */
const accPct = (rows: { isCorrect: boolean }[]): number =>
  rows.length ? Math.round((rows.filter((x) => x.isCorrect).length / rows.length) * 100) : -1

/** Headline stats derived from a sync snapshot (the public-safe summary). */
export function profileStats(
  snap: SyncSnapshot,
): Pick<LeaderRow, 'hands_played' | 'best_streak' | 'accuracy' | 'pre_acc' | 'post_acc'> {
  const d = snap.decisions
  const total = d.length
  const byTime = [...d].sort((a, b) => a.ts - b.ts).map((x) => x.isCorrect)
  const post = d.filter((x) => x.mode === 'postflop')
  const pre = d.filter((x) => x.mode !== 'postflop')
  return {
    hands_played: total,
    best_streak: longestRun(byTime),
    accuracy: Math.max(0, accPct(d)),
    pre_acc: accPct(pre),
    post_acc: accPct(post),
  }
}

/**
 * Publish standings through the server-authoritative `publish-standings` Edge
 * Function (it validates the payload, clamps PP and recomputes crowns). Returns
 * true on success. When the function isn't deployed yet it returns false so the
 * caller can fall back to a direct write, keeping the app working before the
 * server-authority migration is applied.
 */
async function publishViaFunction(body: Record<string, unknown>): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.functions.invoke('publish-standings', { body })
    return !error
  } catch {
    return false
  }
}

/** Publish this user's profile row (called after a sync). No-op when offline. */
export async function upsertProfile(userId: string, snap: SyncSnapshot): Promise<void> {
  if (!supabase) return
  const eq = equipped()
  const profile = {
    user_id: userId,
    handle: displayName(userId),
    ...profileStats(snap),
    pp_earned: await earnedPoints(),
    crowns: dailyWinsClaimed().length, // server recomputes this; sent for the fallback path
    avatar: eq.avatar,
    flair: eq.flair,
    background: eq.background,
    updated_at: new Date().toISOString(),
  }
  if (await publishViaFunction({ profile })) {
    bustLeaderboardCache()
    return
  }
  // fallback: direct write (used until the Edge Function is deployed)
  const { error } = await supabase.from('profiles').upsert(profile)
  if (error) console.error('[leaderboard] upsertProfile failed:', error.message)
  else bustLeaderboardCache()
}

/**
 * Push all locally-completed daily ladder results to the shared leaderboard.
 * Safe to call repeatedly, uses upsert so it's idempotent. This ensures
 * scores completed before sign-in are retroactively submitted on next sync.
 */
const SUBMITTED_KEY = 'lt-daily-submitted'
const submittedMap = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SUBMITTED_KEY) ?? '{}') } catch { return {} }
}
export async function syncDailyScores(userId: string): Promise<void> {
  if (!supabase) return
  // Only upsert results whose published form has changed, turning a per-push
  // N-row write into a no-op in steady state. The key includes the denormalised
  // handle + cosmetics, so renaming or re-skinning still refreshes the rows.
  const eq = equipped()
  const sig = (r: DailyResult) =>
    `${r.score}:${r.timeMs}:${displayName(userId)}|${eq.avatar}|${eq.flair}|${eq.background}`
  const submitted = submittedMap()
  const pending = Object.entries(dailyResults()).filter(
    ([day, r]) => r.completed && submitted[day] !== sig(r),
  )
  if (!pending.length) return
  // Only mark a day as submitted once its write actually succeeds, so a
  // transient failure is retried on the next sync instead of being lost.
  const results = await Promise.all(
    pending.map(async ([day, r]) => [day, r, await submitDailyScore(userId, day, r.score, r.timeMs)] as const),
  )
  let changed = false
  for (const [day, r, ok] of results) {
    if (ok) { submitted[day] = sig(r); changed = true }
  }
  if (changed) localStorage.setItem(SUBMITTED_KEY, JSON.stringify(submitted))
}

/** All-time leaderboard: top players by total Poker Points earned. */
export async function fetchAllTimeLeaderboard(limit = 50): Promise<LeaderRow[]> {
  if (!supabaseConfigured || !supabase) return []
  return cachedRead(`alltime:${limit}`, async () => {
    const { data, error } = await supabase!
      .from('profiles')
      .select(COLS)
      .order('pp_earned', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as unknown as LeaderRow[]
  })
}

/** Back-compat alias used by older callers (streak board → all-time board). */
export const fetchLeaderboard = fetchAllTimeLeaderboard

/** Crowns leaderboard: most daily-ladder wins (times topping the board at reset). */
export async function fetchCrownsLeaderboard(limit = 50): Promise<LeaderRow[]> {
  if (!supabaseConfigured || !supabase) return []
  return cachedRead(`crowns:${limit}`, async () => {
    const { data, error } = await supabase!
      .from('profiles')
      .select(COLS)
      .order('crowns', { ascending: false })
      .order('pp_earned', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as unknown as LeaderRow[]
  })
}

// ---- daily leaderboard -----------------------------------------------------

/** Publish today's ladder score (denormalised cosmetics for cheap render).
 *  Returns true when the row was written, false on error/offline. */
export async function submitDailyScore(userId: string, day: string, score: number, timeMs: number): Promise<boolean> {
  if (!supabase) return false
  const eq = equipped()
  const daily = {
    user_id: userId,
    day,
    score,
    time_ms: timeMs,
    handle: displayName(userId),
    avatar: eq.avatar,
    flair: eq.flair,
    background: eq.background,
    updated_at: new Date().toISOString(),
  }
  // Server-validated path (clamps the score) first; direct write as a fallback.
  if (await publishViaFunction({ daily })) {
    bustLeaderboardCache()
    return true
  }
  const { error } = await supabase.from('daily_scores').upsert(daily, { onConflict: 'user_id,day' })
  if (error) {
    console.error('[leaderboard] submitDailyScore failed:', error.message)
    return false
  }
  bustLeaderboardCache() // a fresh score should show up without waiting out the TTL
  return true
}

/** Today's daily leaderboard: best score first, faster time breaks ties. */
export async function fetchDailyLeaderboard(day: string = dayKey(), limit = 50): Promise<DailyRow[]> {
  if (!supabaseConfigured || !supabase) return []
  return cachedRead(`daily:${day}:${limit}`, async () => {
    const { data, error } = await supabase!
      .from('daily_scores')
      .select('user_id,day,score,time_ms,handle,avatar,flair,background')
      .eq('day', day)
      .order('score', { ascending: false })
      .order('time_ms', { ascending: true })
      .limit(limit)
    if (error || !data) return []
    return data as DailyRow[]
  })
}

// ---- friends ---------------------------------------------------------------

const FRIENDS_KEY = 'lt-friends'
export const getFriends = (): string[] => {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]') } catch { return [] }
}
export function addFriend(id: string): void {
  const f = getFriends()
  if (!f.includes(id)) localStorage.setItem(FRIENDS_KEY, JSON.stringify([...f, id]))
}
export function removeFriend(id: string): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(getFriends().filter((x) => x !== id)))
}

/** Search profiles by handle (case-insensitive, partial match). */
export async function searchByHandle(q: string): Promise<LeaderRow[]> {
  if (!supabase || !q.trim()) return []
  const { data } = await supabase
    .from('profiles')
    .select(COLS)
    .ilike('handle', `%${q.trim()}%`)
    .limit(10)
  return (data as unknown as LeaderRow[]) ?? []
}

/** Fetch leaderboard rows for a specific set of user ids. */
export async function fetchFriendsLeaderboard(friendIds: string[]): Promise<LeaderRow[]> {
  if (!supabase || !friendIds.length) return []
  return cachedRead(`friends:${[...friendIds].sort().join(',')}`, async () => {
    const { data } = await supabase!
      .from('profiles')
      .select(COLS)
      .in('user_id', friendIds)
      .order('pp_earned', { ascending: false })
    return (data as unknown as LeaderRow[]) ?? []
  })
}

// ---- friend requests -------------------------------------------------------

export interface FriendRequest {
  id: string
  from_user: string
  from_handle: string
  from_avatar: string
  from_flair: string
  created_at: string
}

/** Notify another player that you added them (writes to their request inbox).
 *  Denormalises your name + cosmetics so their inbox renders without a join. */
export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
  if (!supabase || fromUserId === toUserId) return
  const eq = equipped()
  const { error } = await supabase.from('friend_requests').upsert(
    {
      from_user: fromUserId,
      to_user: toUserId,
      from_handle: displayName(fromUserId),
      from_avatar: eq.avatar,
      from_flair: eq.flair,
    },
    { onConflict: 'from_user,to_user', ignoreDuplicates: true },
  )
  if (error) console.error('[friends] sendFriendRequest failed:', error.message)
}

/** Incoming friend requests for this user (most recent first). Not cached so the
 *  notification badge clears as soon as a request is accepted or dismissed. */
export async function fetchIncomingRequests(userId: string): Promise<FriendRequest[]> {
  if (!supabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,from_user,from_handle,from_avatar,from_flair,created_at')
    .eq('to_user', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as FriendRequest[]
}

/** Remove a request row (accepting or dismissing both resolve to a delete). */
export async function deleteFriendRequest(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('friend_requests').delete().eq('id', id)
  if (error) console.error('[friends] deleteFriendRequest failed:', error.message)
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
