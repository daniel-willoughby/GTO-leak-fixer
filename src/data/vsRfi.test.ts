import { describe, it, expect } from 'vitest'
import { MATCHUPS, respond, type Matchup } from './vsRfi'

const find = (raiser: string, hero: string): Matchup =>
  MATCHUPS.find((m) => m.raiser === raiser && m.hero === hero)!

describe('vs-RFI responses', () => {
  it('3-bets premiums and folds junk', () => {
    const m = find('CO', 'BB')
    expect(respond(m, 'AA')).toBe('3bet')
    expect(respond(m, '72o')).toBe('fold')
  })

  it('lets the 3-bet range win ties over the call range (A5s bluff)', () => {
    const m = find('CO', 'BB')
    expect(m.threeBet.has('A5s')).toBe(true)
    expect(m.call.has('A5s')).toBe(true) // A2s+ also contains it
    expect(respond(m, 'A5s')).toBe('3bet')
  })

  it('flats a playable hand that is not strong enough to 3-bet', () => {
    const m = find('CO', 'BB')
    expect(respond(m, '65s')).toBe('call')
  })
})
