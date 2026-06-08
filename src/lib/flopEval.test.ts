import { describe, it, expect } from 'vitest'
import { describeHand } from './flopEval'
import { parseCards, type Card } from './cards'

const d = (hole: string, board: string) =>
  describeHand(parseCards(hole) as [Card, Card], parseCards(board))

describe('describeHand', () => {
  it('recognises a made flush instead of "air" (regression)', () => {
    const r = d('KhQh', '9h8h4c2h2c') // five hearts
    expect(r.text).toMatch(/flush/)
    expect(['strong', 'monster']).toContain(r.tier)
  })

  it('calls the ace-high flush on an unpaired board the nut flush', () => {
    const r = d('AdTd', 'Jd7d2dKs5c') // five diamonds, board unpaired, hero holds A♦
    expect(r.text).toMatch(/nut flush/)
    expect(r.tier).toBe('monster')
  })

  it('does not credit a hand that only plays the board (air)', () => {
    expect(d('AsTs', 'Jd7d2s2d2h').tier).toBe('air') // board trips, hero adds nothing
  })

  it('classifies the made-hand ladder', () => {
    expect(d('9c9h', '2s2d2hJd7d').text).toMatch(/full house/)
    expect(d('KhQs', 'JdTc9h2s5d').text).toMatch(/straight/)
    expect(d('2c2h', 'Ah2d7s').text).toMatch(/set/)
    expect(d('Kd9h', 'KsKc5d8h2c').text).toMatch(/trips/)
    expect(d('AhKd', 'Ah7c2d').text).toMatch(/top pair/)
    expect(d('7h6h', '2s9dKc').tier).toBe('air')
  })
})
