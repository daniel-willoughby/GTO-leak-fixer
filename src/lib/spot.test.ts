import { describe, it, expect } from 'vitest'
import {
  judge,
  classifyHand,
  generateSpot,
  spotFromSeed,
  gradeVsDonk,
  buildContinuationSpot,
  generateFreeplaySpot,
  type Spot,
  type HandState,
} from './spot'
import { parseCards, formatBoardCode } from './cards'
import { ALL_NODES, FLOP_NODES } from '../data/postflop'

describe('classifyHand', () => {
  it('classifies hand categories', () => {
    expect(classifyHand('AA')).toBe('Pocket pair')
    expect(classifyHand('AKs')).toBe('Suited ace')
    expect(classifyHand('KQs')).toBe('Suited broadway')
    expect(classifyHand('98s')).toBe('Suited connector')
    expect(classifyHand('72o')).toBe('Offsuit other')
  })
})

const postflop = (freqs: [number, number], correct: 'bet' | 'check'): Spot =>
  ({
    mode: 'postflop',
    heroPos: 'BTN',
    cards: parseCards('AhKh'),
    label: 'AKs',
    correct,
    actions: ['check', 'bet'],
    category: 'Suited ace',
    board: parseCards('As8c3h'),
    freqs,
  }) as unknown as Spot

describe('judge (postflop frequency scoring)', () => {
  it('marks the solver top choice correct', () => {
    expect(judge(postflop([0.22, 0.78], 'bet'), 'bet').quality).toBe('correct')
  })

  it('marks a high-frequency mixed action acceptable', () => {
    const j = judge(postflop([0.6, 0.4], 'check'), 'bet') // bet played 40% ≥ 30%
    expect(j.quality).toBe('acceptable')
    expect(j.isCorrect).toBe(true)
  })

  it('marks a low-frequency action wrong', () => {
    const j = judge(postflop([0.9, 0.1], 'check'), 'bet') // bet played 10% < 30%
    expect(j.quality).toBe('wrong')
    expect(j.isCorrect).toBe(false)
  })
})

describe('rfi edge-mixing (frequency-aware opens)', () => {
  // K7o is a curated BTN mix hand (raised part of the time); folding is the
  // majority play, raising is a defensible part of the mix.
  const mixSpot = (chosen: 'fold' | 'raise') => {
    let s: Spot | undefined
    for (let i = 0; i < 200; i++) {
      const g = generateSpot('rfi', { lockPos: 'BTN' })
      if (g.label === 'K7o') { s = g; break }
    }
    if (!s) throw new Error('expected to deal the K7o mix spot')
    return judge(s, chosen)
  }

  it('a mixed open carries freqs and grades both actions as not-wrong', () => {
    expect(mixSpot('fold').isCorrect).toBe(true)
    expect(mixSpot('raise').isCorrect).toBe(true) // minority action ≥ 30% → acceptable
  })

  it('pure hands stay binary (no freqs): folding a pure open is wrong', () => {
    let pure: Spot | undefined
    for (let i = 0; i < 200; i++) {
      const g = generateSpot('rfi', { lockPos: 'BTN' })
      if (g.label === 'AA') { pure = g; break }
    }
    if (!pure) throw new Error('expected to deal AA')
    expect(pure.freqs).toBeUndefined()
    expect(judge(pure, 'fold').quality).toBe('wrong')
  })
})

describe('generateSpot scope locks', () => {
  it('honours lockPos for rfi', () => {
    for (let i = 0; i < 25; i++) expect(generateSpot('rfi', { lockPos: 'BTN' }).heroPos).toBe('BTN')
  })

  it('honours lockMatchup for vsRfi', () => {
    for (let i = 0; i < 25; i++) {
      const s = generateSpot('vsRfi', { lockMatchup: { raiser: 'CO', hero: 'BTN' } })
      expect(s.raiserPos).toBe('CO')
      expect(s.heroPos).toBe('BTN')
    }
  })
})

describe('spotFromSeed', () => {
  it('round-trips an rfi spot to the correct action', () => {
    expect(spotFromSeed({ mode: 'rfi', heroPos: 'BTN', label: 'A5s' })!.correct).toBe('raise')
    expect(spotFromSeed({ mode: 'rfi', heroPos: 'UTG', label: 'J4o' })!.correct).toBe('fold')
  })

  it('carries the matchup id for multiway and resolves the right action', () => {
    const s = spotFromSeed({ mode: 'multiway', heroPos: 'CO', label: 'AA', matchupId: 'UTG_open_CO_cold' })!
    expect(s.matchupId).toBe('UTG_open_CO_cold')
    expect(s.correct).toBe('3bet')
  })
})

const postflop3 = (freqs: [number, number, number], correct: 'check' | 'bet33' | 'bet75'): Spot =>
  ({
    mode: 'postflop',
    heroPos: 'BTN',
    cards: parseCards('AhKh'),
    label: 'AKs',
    correct,
    actions: ['check', 'bet33', 'bet75'],
    category: 'Suited ace',
    board: parseCards('As8c3h'),
    freqs,
  }) as unknown as Spot

describe('judge (bet-sizing, 3 actions)', () => {
  it('scores each size by its own frequency', () => {
    const s = (c: 'check' | 'bet33' | 'bet75') => postflop3([0.2, 0.5, 0.3], c)
    expect(judge(s('bet33'), 'bet33').quality).toBe('correct')
    expect(judge(s('bet33'), 'bet75').quality).toBe('acceptable') // 30% ≥ threshold
    expect(judge(s('bet33'), 'check').quality).toBe('wrong') // 20% < threshold
  })
})

describe('postflop data integrity', () => {
  it('actions start with check, betSizes line up, and freqs sum to ~1', () => {
    for (const n of ALL_NODES) {
      expect(n.actions[0], n.board).toBe('check')
      expect(n.betSizes.length, n.board).toBe(n.actions.length - 1)
      for (const [lab, fr] of Object.entries(n.strategy)) {
        expect(fr.length, `${n.board}/${lab}`).toBe(n.actions.length)
        const sum = fr.reduce((a, b) => a + b, 0)
        expect(Math.abs(sum - 1), `${n.board}/${lab} sum=${sum}`).toBeLessThan(0.03)
      }
    }
  })

  it('uses only known action tags', () => {
    const ok = new Set(['check', 'bet33', 'bet75'])
    for (const n of ALL_NODES) for (const a of n.actions) expect(ok.has(a), `${n.board}: ${a}`).toBe(true)
  })
})

describe('vs fish: facing a donk bet', () => {
  it('grades by hand strength: raise big, bluff-catch pairs, never bluff', () => {
    expect(gradeVsDonk('monster', 'flop').correct).toBe('raise')
    expect(gradeVsDonk('strong', 'turn').correct).toBe('raise')
    expect(gradeVsDonk('top', 'flop')).toEqual({ correct: 'call', acceptable: ['raise'] })
    expect(gradeVsDonk('weak', 'turn')).toEqual({ correct: 'call', acceptable: ['fold'] })
    expect(gradeVsDonk('draw', 'flop').correct).toBe('call')
    expect(gradeVsDonk('draw', 'river').correct).toBe('fold') // busted draw
    expect(gradeVsDonk('air', 'flop').correct).toBe('fold')
  })

  it('judge scores facing-bet spots via correct/acceptable, not frequencies', () => {
    const spot = {
      mode: 'postflop',
      heroPos: 'BTN',
      cards: parseCards('AhKh'),
      label: 'AKs',
      correct: 'call',
      acceptable: ['raise'],
      actions: ['fold', 'call', 'raise'],
      category: 'Suited ace',
      board: parseCards('Ad8c3h'),
      facingBet: { amountBb: 2.7 },
    } as unknown as Spot
    expect(judge(spot, 'call').quality).toBe('correct')
    expect(judge(spot, 'raise').quality).toBe('acceptable')
    const folded = judge(spot, 'fold')
    expect(folded.quality).toBe('wrong')
    expect(folded.explanation.length).toBeGreaterThan(20)
  })

  it('folding to a lead ends the hand (no continuation)', () => {
    const node = FLOP_NODES[0]
    const state: HandState = {
      heroCards: parseCards('AhKh') as [never, never],
      heroLabel: 'AKs',
      flopNode: node,
      history: [],
      street: 'flop',
      board: parseCards(node.board),
      villain: 'fish',
      facedBet: 2.7,
    } as unknown as HandState
    expect(buildContinuationSpot(state, 'fold')).toBeNull()
  })
})

describe('formatBoardCode', () => {
  it('pretty-prints board codes and leaves other keys alone', () => {
    expect(formatBoardCode('Qs8s4s')).toBe('Q♠ 8♠ 4♠')
    expect(formatBoardCode('Qs8s4s2c')).toBe('Q♠ 8♠ 4♠ · 2♣')
    expect(formatBoardCode('Qs8s4s2c7h')).toBe('Q♠ 8♠ 4♠ · 2♣ 7♥')
    expect(formatBoardCode('BTN')).toBe('BTN')
    expect(formatBoardCode('Suited ace')).toBe('Suited ace')
  })
})

describe('all-seats Freeplay', () => {
  it('generateFreeplaySpot returns null until the dataset is installed', () => {
    expect(generateFreeplaySpot()).toBeNull()
  })

  it('judges a GTO facing-bet spot by solver frequency (not the fish heuristic)', () => {
    const spot = {
      mode: 'postflop',
      heroPos: 'BB',
      cards: parseCards('AhKh'),
      label: 'AKs',
      correct: 'raise',
      actions: ['fold', 'call', 'raise'],
      category: 'Suited ace',
      board: parseCards('Ad8c3h'),
      freqs: [0.1, 0.3, 0.6],
      freeplay: true,
      facingBet: { amountBb: 1.8 },
      street: 'flop',
    } as unknown as Spot
    expect(judge(spot, 'raise').quality).toBe('correct')
    expect(judge(spot, 'call').quality).toBe('acceptable') // 0.30 ≥ threshold
    expect(judge(spot, 'fold').quality).toBe('wrong') // 0.10 < threshold
    expect(judge(spot, 'raise').explanation).toMatch(/GTO plays/)
  })
})
