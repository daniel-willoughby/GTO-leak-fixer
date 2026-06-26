// Poker Points: the spendable currency. PP is *derived*, not a stored balance —
// it recomputes from the decision log, unlocked achievements, and a little
// persisted state (daily ladder results + claimed daily wins). Only purchases
// and equipped cosmetics are mutable state. This keeps sync trivial (the
// decision log already syncs) and means existing players earn PP retroactively.

import { db } from './db'
import { getAchievements } from './achievements'
import {
  FREE_IDS,
  shopItem,
  DEFAULT_AVATAR,
  DEFAULT_FLAIR,
  DEFAULT_BACKGROUND,
  type CosmeticType,
} from './shop'

export const PP_PER_CORRECT = 2
export const DAILY_COMPLETE_BONUS = 20
export const DAILY_WIN_BONUS = 500

const OWNED_KEY = 'lt-owned'
const EQUIP_KEY = 'lt-equip'
const RESULTS_KEY = 'lt-daily-results'
const WINS_KEY = 'lt-daily-wins'

export interface Equipped {
  avatar: string
  flair: string
  background: string
}

export interface DailyResult {
  score: number
  timeMs: number
  completed: boolean
}
type DailyResults = Record<string, DailyResult>

export interface PointsState {
  earned: number
  spent: number
  balance: number
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJSON = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))

// ---- tamper deterrent ------------------------------------------------------
// PP is derived from these localStorage keys, so the easy cheat is to open
// devtools and edit one (e.g. set `lt-daily-wins` to 30 days for +15000 PP).
// We keep a sidecar of signatures over them: an edited value no longer matches
// its signature and is discarded on the next load. This is NOT real security —
// the secret ships in the (minified) bundle, so a determined user reads it —
// but it stops the common "just edit the number" cheat. True enforcement needs
// server-side authority (see the planned Edge-Function task).
const ECON_KEYS = ['lt-owned', 'lt-daily-results', 'lt-daily-wins', 'lt-bonus']
const SIG_KEY = 'lt-econ-sig'
const SECRET = 'pk7c-econ-v1'

function sigOf(raw: string): string {
  let h = 5381
  const s = SECRET + raw
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const readSigs = (): Record<string, string> => readJSON<Record<string, string>>(SIG_KEY, {})

/** Re-sign every economy key from its current value. Call after any legit write
 *  (a purchase, a daily win, a sync) so the signatures stay valid. */
export function signEconomyState(): void {
  const sigs: Record<string, string> = {}
  for (const k of ECON_KEYS) {
    const raw = localStorage.getItem(k)
    if (raw != null) sigs[k] = sigOf(raw)
  }
  writeJSON(SIG_KEY, sigs)
}

/** Discard any economy value that was hand-edited (its signature no longer
 *  matches). Fail-safe: only resets on a *definite* mismatch — unsigned/legacy
 *  values are accepted and signed, never wiped — so legit data is never lost.
 *  Returns true if something was reset. */
export function verifyEconomyState(): boolean {
  const sigs = readSigs()
  let tampered = false
  for (const k of ECON_KEYS) {
    const raw = localStorage.getItem(k)
    if (raw == null) continue
    const expected = sigs[k]
    if (expected != null && sigOf(raw) !== expected) {
      localStorage.removeItem(k) // reverts to the safe default on next read
      tampered = true
    }
  }
  signEconomyState() // re-sign whatever remains (incl. accepting legacy values)
  return tampered
}

// ---- ownership -------------------------------------------------------------

/** All owned item ids, including the free defaults everyone has. */
export function owned(): string[] {
  const bought = readJSON<string[]>(OWNED_KEY, [])
  return [...new Set([...FREE_IDS, ...bought])]
}
export const isOwned = (id: string): boolean => owned().includes(id)

// ---- equipped cosmetics ----------------------------------------------------

export function equipped(): Equipped {
  const e = readJSON<Partial<Equipped>>(EQUIP_KEY, {})
  return {
    avatar: e.avatar ?? DEFAULT_AVATAR,
    flair: e.flair ?? DEFAULT_FLAIR,
    background: e.background ?? DEFAULT_BACKGROUND,
  }
}

/** Equip an owned cosmetic into its slot (or clear the flair with ''). */
export function equip(slot: CosmeticType, id: string): void {
  if (id && !isOwned(id)) return
  writeJSON(EQUIP_KEY, { ...equipped(), [slot]: id })
}

// ---- daily ladder results --------------------------------------------------

export const dailyResults = (): DailyResults => readJSON<DailyResults>(RESULTS_KEY, {})
export const dailyResult = (day: string): DailyResult | undefined => dailyResults()[day]

/** Record a finished ladder; keeps the best score for the day if replayed. */
export function recordDailyResult(day: string, score: number, timeMs: number): DailyResult {
  const all = dailyResults()
  const prev = all[day]
  const better = !prev || score > prev.score || (score === prev.score && timeMs < prev.timeMs)
  const next: DailyResult = better ? { score, timeMs, completed: true } : prev
  all[day] = next
  writeJSON(RESULTS_KEY, all)
  signEconomyState()
  return next
}

// ---- claimed daily wins ----------------------------------------------------

export const dailyWinsClaimed = (): string[] => readJSON<string[]>(WINS_KEY, [])
export const hasClaimedDailyWin = (day: string): boolean => dailyWinsClaimed().includes(day)

/** Grant the daily-winner bonus for a day, once. Returns true if newly granted. */
export function grantDailyWin(day: string): boolean {
  const claimed = dailyWinsClaimed()
  if (claimed.includes(day)) return false
  writeJSON(WINS_KEY, [...claimed, day])
  signEconomyState()
  return true
}

// ---- one-off named bonuses -------------------------------------------------

const BONUS_KEY = 'lt-bonus'

// Hand-granted, one-time PP gifts keyed by the player's handle (case-insensitive).
// Once a matching handle claims it the id is stored, so the balance keeps the
// bonus even after a later rename. Keyed on the username, so it's exactly as
// trustworthy as that name — fine for a personal gift, not anti-cheat.
const NAMED_BONUSES: { handle: string; id: string; pp: number }[] = [
  { handle: 'george', id: 'george-grant-5000', pp: 5000 },
]

export const claimedBonuses = (): string[] => readJSON<string[]>(BONUS_KEY, [])

/** Total PP from one-off bonuses this device has claimed. */
export function bonusPoints(): number {
  const claimed = new Set(claimedBonuses())
  return NAMED_BONUSES.filter((b) => claimed.has(b.id)).reduce((sum, b) => sum + b.pp, 0)
}

/** Claim any one-off bonus the given handle qualifies for. Idempotent; returns
 *  the PP newly granted (0 when there's nothing new to claim). */
export function claimNamedBonus(handle: string): number {
  const h = handle.trim().toLowerCase()
  if (!h) return 0
  const claimed = claimedBonuses()
  let granted = 0
  for (const b of NAMED_BONUSES) {
    if (b.handle === h && !claimed.includes(b.id)) {
      claimed.push(b.id)
      granted += b.pp
    }
  }
  if (granted) {
    writeJSON(BONUS_KEY, claimed)
    signEconomyState()
  }
  return granted
}

// ---- derivation ------------------------------------------------------------

/**
 * Pure PP-earned formula. Takes the two values that live in Dexie (correct
 * decision count + total reward of unlocked achievements); reads the daily
 * parts from localStorage. Kept pure so it's unit-testable without IndexedDB.
 */
export function derivedEarned(correctCount: number, achievementReward: number): number {
  const fromPlay = correctCount * PP_PER_CORRECT
  const completes = Object.values(dailyResults()).filter((r) => r.completed).length
  const fromDailyComplete = completes * DAILY_COMPLETE_BONUS
  const fromDailyWins = dailyWinsClaimed().length * DAILY_WIN_BONUS
  return fromPlay + achievementReward + fromDailyComplete + fromDailyWins + bonusPoints()
}

/** Total PP ever earned (the all-time leaderboard figure). */
export async function earnedPoints(): Promise<number> {
  const correct = await db.decisions.filter((d) => d.isCorrect).count()
  const achievements = await getAchievements()
  const reward = achievements.filter((a) => a.done).reduce((sum, a) => sum + a.reward, 0)
  return derivedEarned(correct, reward)
}

/** PP spent on owned (non-free) cosmetics. */
export function spentPoints(): number {
  return readJSON<string[]>(OWNED_KEY, []).reduce((sum, id) => sum + (shopItem(id)?.cost ?? 0), 0)
}

export async function pointsState(): Promise<PointsState> {
  const earned = await earnedPoints()
  const spent = spentPoints()
  return { earned, spent, balance: earned - spent }
}

/** Buy a shop item if affordable and not already owned. */
export async function buyItem(id: string): Promise<{ ok: boolean; reason?: string }> {
  const item = shopItem(id)
  if (!item) return { ok: false, reason: 'Unknown item' }
  if (isOwned(id)) return { ok: false, reason: 'Already owned' }
  const { balance } = await pointsState()
  if (balance < item.cost) return { ok: false, reason: 'Not enough points' }
  writeJSON(OWNED_KEY, [...readJSON<string[]>(OWNED_KEY, []), id])
  signEconomyState()
  return { ok: true }
}

export function resetPoints(): void {
  for (const k of [OWNED_KEY, EQUIP_KEY, RESULTS_KEY, WINS_KEY, BONUS_KEY, SIG_KEY]) localStorage.removeItem(k)
}
