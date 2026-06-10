import { describe, it, expect } from 'vitest'
import { parseHandHistory } from './hhParser'

const SEATS = `Seat 1: Hero ($10 in chips)
Seat 2: P2 ($10 in chips)
Seat 3: P3 ($10 in chips)
Seat 4: P4 ($10 in chips)
Seat 5: P5 ($10 in chips)
Seat 6: P6 ($10 in chips)`

/** Hero is BTN (seat 1 = button), opens, BB (P3) calls, then acts on the flop. */
const cbetHand = (n: number, cards: string, board: string, heroFlop: string) => `PokerStars Hand #${n}: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:00:00 ET
Table 'T' 6-max Seat #1 is the button
${SEATS}
P2: posts small blind $0.05
P3: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [${cards}]
P4: folds
P5: folds
P6: folds
Hero: raises $0.20 to $0.30
P2: folds
P3: calls $0.20
*** FLOP *** [${board}]
P3: checks
Hero: ${heroFlop}`

/** Hero is BB (seat 3), CO (P6) opens, Hero calls, checks, villain c-bets, Hero responds. */
const faceHand = (n: number, cards: string, board: string, heroResp: string) => `PokerStars Hand #${n}: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:00:00 ET
Table 'T' 6-max Seat #1 is the button
${SEATS}
P2: posts small blind $0.05
Hero: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [${cards}]
P4: folds
P5: folds
P6: raises $0.20 to $0.30
P2: folds
Hero: calls $0.20
*** FLOP *** [${board}]
Hero: checks
P6: bets $0.20
Hero: ${heroResp}`

describe('hand-history postflop tendencies', () => {
  it('measures flop c-bet frequency as the heads-up raiser', () => {
    const hh = [
      cbetHand(1, 'Ah Kd', 'Qs 7h 2c', 'bets $0.15'),
      cbetHand(2, 'Js Td', '9h 6d 2s', 'bets $0.15'),
      cbetHand(3, 'Tc 9c', 'Ad 7s 4h', 'bets $0.15'),
      cbetHand(4, '5h 5d', 'Ks Qd Jc', 'checks'),
    ].join('\n\n')
    const r = parseHandHistory(hh)
    expect(r.cbet).toBeDefined()
    expect(r.cbet!.spots).toBe(4)
    expect(r.cbet!.hits).toBe(3) // 3 bets, 1 check
    expect(Math.round(r.cbet!.freq * 100)).toBe(75)
  })

  it('measures fold-to-c-bet for an out-of-position caller', () => {
    const hh = [
      faceHand(1, 'Qh Jh', 'As 8c 3h', 'folds'),
      faceHand(2, 'Td 9d', 'Ks 7h 2c', 'folds'),
      faceHand(3, '6c 6d', 'Ah Kd 4s', 'folds'),
      faceHand(4, 'Ac Qs', 'Qd 8h 5c', 'calls $0.20'),
    ].join('\n\n')
    const r = parseHandHistory(hh)
    expect(r.foldToCbet).toBeDefined()
    expect(r.foldToCbet!.spots).toBe(4)
    expect(r.foldToCbet!.hits).toBe(3) // folded 3 of 4
    expect(Math.round(r.foldToCbet!.freq * 100)).toBe(75)
  })

  it('ignores multiway flops (only heads-up counts)', () => {
    // Hero opens, two callers → 3-way flop, should not be a c-bet spot
    const hh = `PokerStars Hand #1: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:00:00 ET
Table 'T' 6-max Seat #1 is the button
${SEATS}
P2: posts small blind $0.05
P3: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
P4: folds
P5: calls $0.10
P6: folds
Hero: raises $0.30 to $0.40
P2: folds
P3: calls $0.30
P5: calls $0.30
*** FLOP *** [Qs 7h 2c]
P3: checks
P5: checks
Hero: bets $0.50`
    const r = parseHandHistory(hh)
    expect(r.cbet).toBeUndefined()
  })
})
