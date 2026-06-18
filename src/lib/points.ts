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
  return true
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
  return fromPlay + achievementReward + fromDailyComplete + fromDailyWins
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
  return { ok: true }
}

export function resetPoints(): void {
  for (const k of [OWNED_KEY, EQUIP_KEY, RESULTS_KEY, WINS_KEY]) localStorage.removeItem(k)
}
