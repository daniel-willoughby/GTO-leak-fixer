import { describe, it, expect, beforeEach } from 'vitest'
import {
  derivedEarned,
  spentPoints,
  owned,
  isOwned,
  equip,
  equipped,
  recordDailyResult,
  dailyResult,
  grantDailyWin,
  hasClaimedDailyWin,
  lootOwnedIds,
  lootSpend,
  resetPoints,
  PP_PER_CORRECT,
  DAILY_COMPLETE_BONUS,
  DAILY_WIN_BONUS,
} from './points'
import { FREE_IDS, DEFAULT_AVATAR } from './shop'

beforeEach(() => {
  localStorage.clear()
  resetPoints()
})

describe('PP earned derivation', () => {
  it('combines play, achievements, daily completes and wins', () => {
    expect(derivedEarned(10, 0)).toBe(10 * PP_PER_CORRECT)
    expect(derivedEarned(0, 175)).toBe(175)
    recordDailyResult('2026-06-18', 18, 1000)
    grantDailyWin('2026-06-17')
    expect(derivedEarned(5, 50)).toBe(5 * PP_PER_CORRECT + 50 + DAILY_COMPLETE_BONUS + DAILY_WIN_BONUS)
  })
})

describe('ownership and spending', () => {
  it('free items are owned by default and cost nothing', () => {
    expect(owned()).toEqual(expect.arrayContaining(FREE_IDS))
    expect(spentPoints()).toBe(0)
  })

  it('buying records the item and counts its cost as spent', () => {
    // simulate a purchase by writing to owned via equip path is not allowed; use the store directly
    localStorage.setItem('lt-owned', JSON.stringify(['avatar-owl']))
    expect(isOwned('avatar-owl')).toBe(true)
    expect(spentPoints()).toBe(400)
  })

  it('loot-won items are owned for free; only the box price is spent', () => {
    // an opened box: paid 250 for the Wolf (worth 800), it counts as owned but
    // its own cost must NOT add to spend; only the 250 box price does.
    localStorage.setItem('lt-loot', JSON.stringify({ open1: { item: 'avatar-wolf', cost: 250 } }))
    expect(lootOwnedIds()).toEqual(['avatar-wolf'])
    expect(isOwned('avatar-wolf')).toBe(true)
    expect(lootSpend()).toBe(250)
    expect(spentPoints()).toBe(250) // not 250 + 800
  })
})

describe('equipping cosmetics', () => {
  it('defaults to the free avatar and only equips owned items', () => {
    expect(equipped().avatar).toBe(DEFAULT_AVATAR)
    equip('avatar', 'avatar-wolf') // not owned → ignored
    expect(equipped().avatar).toBe(DEFAULT_AVATAR)
    localStorage.setItem('lt-owned', JSON.stringify(['avatar-wolf']))
    equip('avatar', 'avatar-wolf')
    expect(equipped().avatar).toBe('avatar-wolf')
  })

  it('allows clearing the flair slot with empty string', () => {
    localStorage.setItem('lt-owned', JSON.stringify(['flair-fire']))
    equip('flair', 'flair-fire')
    expect(equipped().flair).toBe('flair-fire')
    equip('flair', '')
    expect(equipped().flair).toBe('')
  })
})

describe('daily results and wins', () => {
  it('keeps the best score when a day is replayed', () => {
    recordDailyResult('2026-06-18', 12, 5000)
    recordDailyResult('2026-06-18', 17, 9000)
    expect(dailyResult('2026-06-18')?.score).toBe(17)
    recordDailyResult('2026-06-18', 15, 1000) // lower score → ignored
    expect(dailyResult('2026-06-18')?.score).toBe(17)
  })

  it('grants a daily win bonus only once per day', () => {
    expect(grantDailyWin('2026-06-17')).toBe(true)
    expect(grantDailyWin('2026-06-17')).toBe(false)
    expect(hasClaimedDailyWin('2026-06-17')).toBe(true)
  })
})
