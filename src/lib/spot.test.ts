import { describe, it, expect } from 'vitest'
import { judge, classifyHand, generateSpot, spotFromSeed, type Spot } from './spot'
import { parseCards } from './cards'
import { ALL_NODES } from '../data/postflop'

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
