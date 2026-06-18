import { describe, it, expect } from 'vitest'
import { dailyLadderSeeds, LADDER_LEN } from './dailyLadder'

describe('daily ladder generation', () => {
  it('is deterministic for a given day (same seeds every call)', () => {
    const a = dailyLadderSeeds('2026-06-18')
    const b = dailyLadderSeeds('2026-06-18')
    expect(a).toEqual(b)
  })

  it('produces exactly the ladder length', () => {
    expect(dailyLadderSeeds('2026-06-18')).toHaveLength(LADDER_LEN)
  })

  it('climbs from preflop opens to postflop spots', () => {
    const seeds = dailyLadderSeeds('2026-06-18')
    // first five rungs are RFI opens
    for (let i = 0; i < 5; i++) expect(seeds[i].mode).toBe('rfi')
    // last five rungs are postflop
    for (let i = LADDER_LEN - 5; i < LADDER_LEN; i++) expect(seeds[i].mode).toBe('postflop')
  })

  it('differs across days', () => {
    expect(dailyLadderSeeds('2026-06-18')).not.toEqual(dailyLadderSeeds('2026-06-19'))
  })

  it('does not leak the seeded RNG (Math.random restored)', () => {
    const before = Math.random
    dailyLadderSeeds('2026-06-18')
    expect(Math.random).toBe(before)
  })
})
