import { describe, it, expect } from 'vitest'
import { isRfiHand, rfiFreq, RFI_RANGES, RFI_POSITIONS } from './ranges'

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

  describe('edge-mixing frequencies', () => {
    it('pure-core hands raise 1.0, trash folds 0.0', () => {
      expect(rfiFreq('UTG', 'AA')).toBe(1)
      expect(rfiFreq('BTN', 'K9o')).toBe(1) // in BTN pure core
      expect(rfiFreq('UTG', '72o')).toBe(0)
    })

    it('curated edge hands open at a partial frequency between 0 and 1', () => {
      const f = rfiFreq('BTN', 'K7o') // BTN mix entry
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThan(1)
    })

    it('every mix key lies outside the pure-raise core (no contradictions)', () => {
      for (const p of RFI_POSITIONS) {
        for (const label of Object.keys(RFI_RANGES[p].mix)) {
          expect(RFI_RANGES[p].hands.has(label), `${p}:${label} is both pure and mixed`).toBe(false)
          const v = RFI_RANGES[p].mix[label]
          expect(v).toBeGreaterThan(0)
          expect(v).toBeLessThan(1)
        }
      }
    })
  })
})
