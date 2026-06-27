import { describe, it, expect } from 'vitest'
import { LOOT_BOXES, SPECIAL_IDS, SPECIAL_PULL_RATE, SHOP, FREE_IDS } from './shop'

describe('shop specials', () => {
  it('has two ultra-rare specials with a 2% pull rate', () => {
    expect(SPECIAL_IDS).toHaveLength(2)
    expect(SPECIAL_PULL_RATE).toBeCloseTo(0.02)
  })

  it('specials never appear in any normal loot-box pool', () => {
    for (const box of LOOT_BOXES) {
      const pool = box.pool()
      for (const sid of SPECIAL_IDS) expect(pool).not.toContain(sid)
    }
  })

  it('specials are not free and not buyable by default (loot-only)', () => {
    for (const sid of SPECIAL_IDS) {
      const item = SHOP.find((i) => i.id === sid)!
      expect(item.special).toBe(true)
      expect(FREE_IDS).not.toContain(sid)
    }
  })
})
