// Lightweight made-hand / draw classifier for explaining postflop decisions.
// Not a full evaluator — just enough to phrase a useful "why".

import { rankIndex, type Card } from './cards'

export type Tier = 'monster' | 'strong' | 'top' | 'weak' | 'draw' | 'air'

export interface HandDesc {
  text: string
  tier: Tier
}

// value with Ace high = 14 .. 2 = 2 (rankIndex is A=0..2=12)
const val = (c: Card) => 14 - rankIndex(c.rank)

function flushDraw(hole: [Card, Card], board: Card[]): boolean {
  if (hole[0].suit !== hole[1].suit) return false
  const suit = hole[0].suit
  const total = 2 + board.filter((c) => c.suit === suit).length
  return total === 4 // 4 to a flush = draw (3 = backdoor, ignored)
}

function straightDraw(hole: [Card, Card], board: Card[]): boolean {
  const holeVals = new Set(hole.map(val))
  const all = new Set<number>([...holeVals])
  for (const c of board) all.add(val(c))
  if (all.has(14)) all.add(1) // wheel
  // any 5-rank window containing >=4 of our ranks, with a hole card involved
  for (let lo = 1; lo <= 10; lo++) {
    let count = 0
    let usesHole = false
    for (let v = lo; v < lo + 5; v++) {
      if (all.has(v)) {
        count++
        if (holeVals.has(v) || (v === 1 && holeVals.has(14))) usesHole = true
      }
    }
    if (count >= 4 && usesHole) return true
  }
  return false
}

export function describeHand(hole: [Card, Card], board: Card[]): HandDesc {
  const [h1, h2] = hole
  const boardIdx = board.map((c) => rankIndex(c.rank))
  const topBoard = Math.min(...boardIdx) // strongest board card (lowest index)
  const botBoard = Math.max(...boardIdx)

  let made = ''
  let tier: Tier = 'air'

  if (h1.rank === h2.rank) {
    const p = rankIndex(h1.rank)
    if (board.some((c) => c.rank === h1.rank)) {
      made = 'a set'
      tier = 'monster'
    } else if (p < topBoard) {
      made = 'an overpair'
      tier = 'strong'
    } else {
      made = 'an underpair'
      tier = 'weak'
    }
  } else {
    const matched = board.filter((c) => c.rank === h1.rank || c.rank === h2.rank)
    if (matched.length >= 2) {
      made = 'two pair'
      tier = 'strong'
    } else if (matched.length === 1) {
      const m = rankIndex(matched[0].rank)
      if (m === topBoard) {
        made = 'top pair'
        tier = 'top'
      } else if (m === botBoard) {
        made = 'bottom pair'
        tier = 'weak'
      } else {
        made = 'middle pair'
        tier = 'weak'
      }
    }
  }

  const draws: string[] = []
  if (flushDraw(hole, board)) draws.push('a flush draw')
  if (straightDraw(hole, board)) draws.push('a straight draw')

  if (made && draws.length) return { text: `${made} with ${draws.join(' and ')}`, tier: tier === 'weak' ? 'top' : tier }
  if (made) return { text: made, tier }
  if (draws.length) return { text: draws.join(' and '), tier: 'draw' }
  return { text: 'no pair and no draw (air)', tier: 'air' }
}
