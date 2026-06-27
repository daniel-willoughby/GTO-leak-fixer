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
  lootBox,
  SPECIAL_IDS,
  SPECIAL_PULL_RATE,
  DEFAULT_AVATAR,
  DEFAULT_FLAIR,
  DEFAULT_BACKGROUND,
  DEFAULT_CARDBACK,
  DEFAULT_FELT,
  type CosmeticType,
} from './shop'

export const PP_PER_CORRECT = 2
export const DAILY_COMPLETE_BONUS = 100
export const DAILY_WIN_BONUS = 500

/** How far into the red a player is allowed to go on a duel wager. You can't
 *  start a duel while already in debt, and a wager can't push you past this. */
export const MAX_DEBT = 500

const OWNED_KEY = 'lt-owned'
const EQUIP_KEY = 'lt-equip'
const RESULTS_KEY = 'lt-daily-results'
const WINS_KEY = 'lt-daily-wins'

export interface Equipped {
  avatar: string
  flair: string
  background: string
  cardback: string
  felt: string
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
const ECON_KEYS = ['lt-owned', 'lt-daily-results', 'lt-daily-wins', 'lt-bonus', 'lt-duel-ledger', 'lt-duel-record', 'lt-loot']
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

/** All owned item ids, including the free defaults everyone has and anything
 *  won from a loot box (paid for at the box price, not the item's own cost). */
export function owned(): string[] {
  const bought = readJSON<string[]>(OWNED_KEY, [])
  return [...new Set([...FREE_IDS, ...bought, ...lootOwnedIds()])]
}
export const isOwned = (id: string): boolean => owned().includes(id)

// ---- equipped cosmetics ----------------------------------------------------

export function equipped(): Equipped {
  const e = readJSON<Partial<Equipped>>(EQUIP_KEY, {})
  return {
    avatar: e.avatar ?? DEFAULT_AVATAR,
    flair: e.flair ?? DEFAULT_FLAIR,
    background: e.background ?? DEFAULT_BACKGROUND,
    cardback: e.cardback ?? DEFAULT_CARDBACK,
    felt: e.felt ?? DEFAULT_FELT,
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

// ---- duel wagers -----------------------------------------------------------

const DUEL_LEDGER_KEY = 'lt-duel-ledger'
const DUEL_RECORD_KEY = 'lt-duel-record'
type DuelLedger = Record<string, number> // duelId -> PP delta (+win / -loss / 0)
export type DuelOutcome = 'win' | 'loss' | 'push'
type DuelRecord = Record<string, DuelOutcome> // duelId -> result (for win/play stats)

const duelLedger = (): DuelLedger => readJSON<DuelLedger>(DUEL_LEDGER_KEY, {})
const duelRecord = (): DuelRecord => readJSON<DuelRecord>(DUEL_RECORD_KEY, {})

/** Net PP won (negative if down) across all settled duels. A per-duel ledger so
 *  it merges cleanly across devices (union of {id: delta}). */
export const duelNet = (): number => Object.values(duelLedger()).reduce((s, v) => s + v, 0)

/** Win/play tallies across all settled duels — used by the duel achievements. */
export function duelStats(): { played: number; won: number; lost: number; net: number } {
  const vals = Object.values(duelRecord())
  return {
    played: vals.length,
    won: vals.filter((v) => v === 'win').length,
    lost: vals.filter((v) => v === 'loss').length,
    net: duelNet(),
  }
}

/** Record a finished duel's wager outcome once. `delta` is +wager (win),
 *  -wager (loss) or 0 (push); `outcome` is the win/loss/push for stats.
 *  Returns true if it was newly settled. */
export function settleDuel(duelId: string, delta: number, outcome: DuelOutcome): boolean {
  const led = duelLedger()
  if (duelId in led) return false
  led[duelId] = Math.round(delta)
  writeJSON(DUEL_LEDGER_KEY, led)
  const rec = duelRecord()
  rec[duelId] = outcome
  writeJSON(DUEL_RECORD_KEY, rec)
  signEconomyState()
  return true
}

// ---- loot boxes ------------------------------------------------------------
// A loot box is a gamble: pay the box price and receive a random cosmetic you
// don't own yet. The granted item is "free" (you paid the box, not the item),
// so it must NOT also count toward `spentPoints`. We track each opening in its
// own map keyed by a random id, so openings merge cleanly across devices (like
// the duel ledger) and the spend is the sum of box prices, not item costs.
const LOOT_KEY = 'lt-loot'
type LootOpenings = Record<string, { item: string; cost: number }>

const lootOpenings = (): LootOpenings => readJSON<LootOpenings>(LOOT_KEY, {})

/** Item ids won from loot boxes (each counts as owned, but is free). */
export const lootOwnedIds = (): string[] => [...new Set(Object.values(lootOpenings()).map((o) => o.item))]

/** Total PP spent opening loot boxes (the box prices, not the items won). */
export const lootSpend = (): number => Object.values(lootOpenings()).reduce((s, o) => s + o.cost, 0)

/**
 * Open a loot box: spend its price and receive a random item from its pool that
 * you don't already own. Returns the won item id, or a reason it couldn't open
 * (can't afford it, or you already own everything inside).
 */
export async function openLootBox(boxId: string): Promise<{ ok: boolean; itemId?: string; reason?: string }> {
  const box = lootBox(boxId)
  if (!box) return { ok: false, reason: 'Unknown box' }
  const own = new Set(owned())
  const pool = box.pool().filter((id) => !own.has(id))
  if (!pool.length) return { ok: false, reason: 'You already own everything in this box' }
  const { balance } = await pointsState()
  if (balance < box.cost) return { ok: false, reason: 'Not enough points' }
  // Any box can pull an ultra-rare special at a small per-special chance, on top
  // of its normal price-band drop. Roll the specials first; otherwise fall back
  // to a normal item from the band (always something, so you're never charged
  // for nothing).
  let itemId: string | undefined
  for (const sid of SPECIAL_IDS) {
    if (!own.has(sid) && Math.random() < SPECIAL_PULL_RATE) {
      itemId = sid
      break
    }
  }
  if (!itemId) itemId = pool[Math.floor(Math.random() * pool.length)]
  const openings = lootOpenings()
  const openId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  openings[openId] = { item: itemId, cost: box.cost }
  writeJSON(LOOT_KEY, openings)
  signEconomyState()
  return { ok: true, itemId }
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
  return fromPlay + achievementReward + fromDailyComplete + fromDailyWins + bonusPoints() + duelNet()
}

/** Total PP ever earned (the all-time leaderboard figure). */
export async function earnedPoints(): Promise<number> {
  const correct = await db.decisions.filter((d) => d.isCorrect).count()
  const achievements = await getAchievements()
  const reward = achievements.filter((a) => a.done).reduce((sum, a) => sum + a.reward, 0)
  return derivedEarned(correct, reward)
}

/** PP spent on owned (non-free) cosmetics plus loot boxes opened. */
export function spentPoints(): number {
  const onCosmetics = readJSON<string[]>(OWNED_KEY, []).reduce((sum, id) => sum + (shopItem(id)?.cost ?? 0), 0)
  return onCosmetics + lootSpend()
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
  for (const k of [OWNED_KEY, EQUIP_KEY, RESULTS_KEY, WINS_KEY, BONUS_KEY, DUEL_LEDGER_KEY, DUEL_RECORD_KEY, LOOT_KEY, SIG_KEY])
    localStorage.removeItem(k)
}
