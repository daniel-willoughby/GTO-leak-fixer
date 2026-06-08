import { describe, it, expect } from 'vitest'
import { isRfiHand, RFI_RANGES, RFI_POSITIONS } from './ranges'

describe('RFI ranges', () => {
  it('opens AA from every position and folds 72o everywhere', () => {
    for (const p of RFI_POSITIONS) {
      expect(isRfiHand(p, 'AA')).toBe(true)
      expect(isRfiHand(p, '72o')).toBe(false)
    }
  })

  it('opens wider on the button than under the gun', () => {
    expect(RFI_RANGES.BTN.pct).toBeGreaterThan(RFI_RANGES.UTG.pct)
    expect(RFI_RANGES.BTN.hands.size).toBeGreaterThan(RFI_RANGES.UTG.hands.size)
  })

  it('opens a marginal hand on the button but folds it UTG', () => {
    expect(isRfiHand('BTN', 'K9o')).toBe(true)
    expect(isRfiHand('UTG', 'K9o')).toBe(false)
  })
})
