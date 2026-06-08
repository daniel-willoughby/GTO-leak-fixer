import { describe, it, expect } from 'vitest'
import { MULTIWAY_MATCHUPS, respondMultiway, type MultiwayMatchup } from './multiway'

const byId = (id: string): MultiwayMatchup => MULTIWAY_MATCHUPS.find((m) => m.id === id)!

describe('multiway responses', () => {
  it('cold-4-bets value hands in a 3-bet pot (regression: they used to fold)', () => {
    const m = byId('BTN_open_BB_3bet_BTN_defend')
    for (const h of ['AA', 'KK', 'AKs', 'AKo', 'A5s']) expect(respondMultiway(m, h)).toBe('cold-4bet')
    expect(respondMultiway(m, '72o')).toBe('fold')
  })

  it('labels a heads-up cold raise as a 3-bet, not a squeeze (regression)', () => {
    const m = byId('UTG_open_CO_cold')
    expect(respondMultiway(m, 'AKs')).toBe('3bet')
    expect(respondMultiway(m, '72o')).toBe('fold')
  })

  it('squeezes over a raise + caller', () => {
    const m = byId('UTG_open_HJ_call_CO_squeeze')
    expect(respondMultiway(m, 'QQ')).toBe('squeeze')
    expect(respondMultiway(m, '72o')).toBe('fold')
  })

  it('every matchup can actually reach its aggressive action', () => {
    for (const m of MULTIWAY_MATCHUPS) {
      const aggro = m.actions.find((a) => a === 'squeeze' || a === 'cold-4bet' || a === '3bet')
      if (!aggro) continue
      const reached = ['AA', 'KK', 'AKs', 'AKo', 'A5s', 'QQ'].some((h) => respondMultiway(m, h) === aggro)
      expect(reached, `${m.id} should reach ${aggro}`).toBe(true)
    }
  })
})
