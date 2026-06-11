import { describe, it, expect } from 'vitest'
import { openerOf, heroSeatOf, freeplayStrategy, randomFreeplayNode, FREEPLAY_READY, type FreeplayNode } from './freeplay'

const fakeNode = (over: Partial<FreeplayNode> = {}): FreeplayNode => ({
  spot: 'CO_vs_BB_SRP',
  board: 'As8c3h',
  street: 'flop',
  kind: 'face_cbet',
  hero: 'OOP',
  facing: 'bet',
  history: [],
  betSizes: [],
  actions: ['fold', 'call', 'raise'],
  strategy: { AKs: [0.1, 0.3, 0.6], '72o': [0.9, 0.1, 0] },
  ...over,
})

describe('freeplay data layer', () => {
  it('reads the opener and hero seat from the matchup id', () => {
    expect(openerOf('CO_vs_BB_SRP')).toBe('CO')
    expect(heroSeatOf(fakeNode({ hero: 'IP' }))).toBe('CO') // opener is the IP seat
    expect(heroSeatOf(fakeNode({ hero: 'OOP' }))).toBe('BB') // BB is the defender
  })

  it('resolves a label to its argmax action', () => {
    expect(freeplayStrategy(fakeNode(), 'AKs')!.primary).toBe('raise')
    expect(freeplayStrategy(fakeNode(), '72o')!.primary).toBe('fold')
    expect(freeplayStrategy(fakeNode(), 'QQ')).toBeNull()
  })

  it('is empty until the all-seats dataset is solved + installed', () => {
    expect(FREEPLAY_READY).toBe(false)
    expect(randomFreeplayNode()).toBeNull()
  })
})
