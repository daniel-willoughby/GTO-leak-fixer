// Lightweight made-hand / draw classifier for explaining postflop decisions.
// Not a full evaluator with kickers, just enough to phrase a useful "why",
// but it does recognise every 5-card category (flush, straight, full house,
// quads, straight flush) so strong hands are never mislabelled as "air".

import { rankIndex, type Card } from './cards'

export type Tier = 'monster' | 'strong' | 'top' | 'weak' | 'draw' | 'air'

export interface HandDesc {
  text: string
  tier: Tier
}

// value with Ace high = 14 .. 2 = 2 (rankIndex is A=0..2=12)
const val = (c: Card) => 14 - rankIndex(c.rank)

/** Highest top-card of a 5-in-a-row in `vals` (Ace plays high or low), else 0. */
function bestStraight(vals: Iterable<number>): number {
  const s = new Set(vals)
  if (s.has(14)) s.add(1) // wheel
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true
    for (let v = hi; v > hi - 5; v--) if (!s.has(v)) { ok = false; break }
    if (ok) return hi
  }
  return 0
}

// 5-card category rank: 8 straight flush, 7 quads, 6 full house, 5 flush,
// 4 straight, 3 trips, 2 two pair, 1 pair, 0 high card. Works for 3-7 cards.
function catRank(cards: Card[]): number {
  const vals = cards.map(val)
  const byRank = new Map<number, number>()
  for (const v of vals) byRank.set(v, (byRank.get(v) ?? 0) + 1)
  const bySuit = new Map<string, number[]>()
  for (const c of cards) {
    const a = bySuit.get(c.suit) ?? []
    a.push(val(c))
    bySuit.set(c.suit, a)
  }
  const counts = [...byRank.values()].sort((a, b) => b - a)
  let flushVals: number[] | null = null
  for (const a of bySuit.values()) if (a.length >= 5) flushVals = a
  const straight = bestStraight(vals) > 0
  const straightFlush = flushVals ? bestStraight(flushVals) > 0 : false
  if (straightFlush) return 8
  if (counts[0] >= 4) return 7
  if (counts[0] >= 3 && counts[1] >= 2) return 6
  if (flushVals) return 5
  if (straight) return 4
  if (counts[0] >= 3) return 3
  if (counts[0] >= 2 && counts[1] >= 2) return 2
  if (counts[0] >= 2) return 1
  return 0
}

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

/** Does hero hold the highest possible card of the made-flush suit? */
function holdsNutFlushCard(hole: [Card, Card], board: Card[]): boolean {
  const all = [...hole, ...board]
  const bySuit = new Map<string, number>()
  for (const c of all) bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1)
  let suit: string | null = null
  for (const [s, n] of bySuit) if (n >= 5) suit = s
  if (!suit) return false
  // Walk ranks high→low; the nut card is the first suited rank not on the board.
  for (let v = 14; v >= 2; v--) {
    const onBoard = board.some((c) => c.suit === suit && val(c) === v)
    if (onBoard) continue
    return hole.some((c) => c.suit === suit && val(c) === v)
  }
  return false
}

function withDraws(made: string, tier: Tier, draws: string[]): HandDesc {
  if (draws.length) return { text: `${made} with ${draws.join(' and ')}`, tier: tier === 'weak' ? 'top' : tier }
  return { text: made, tier }
}

export function describeHand(hole: [Card, Card], board: Card[]): HandDesc {
  const [h1, h2] = hole
  const cWith = catRank([...hole, ...board])
  const cBoard = catRank(board)
  // Only credit a made hand if hero's cards actually beat what's already on the
  // board, otherwise hero is "playing the board" and it's not really their hand.
  const improves = cWith > cBoard
  const boardPaired = new Set(board.map((c) => c.rank)).size < board.length

  const boardIdx = board.map((c) => rankIndex(c.rank))
  const topBoard = Math.min(...boardIdx) // strongest board card (lowest index)
  const botBoard = Math.max(...boardIdx)

  const draws: string[] = []
  if (flushDraw(hole, board)) draws.push('a flush draw')
  if (straightDraw(hole, board)) draws.push('a straight draw')

  // ---- big made hands (flush and up, or a straight) ----
  if (improves) {
    if (cWith === 8) return { text: 'a straight flush', tier: 'monster' }
    if (cWith === 7) return { text: 'four of a kind', tier: 'monster' }
    if (cWith === 6) return { text: 'a full house', tier: 'monster' }
    if (cWith === 5) {
      // a flush is only the effective nuts on an unpaired board (no full houses)
      const nut = holdsNutFlushCard(hole, board) && !boardPaired
      return { text: nut ? 'the nut flush' : 'a flush', tier: nut ? 'monster' : 'strong' }
    }
    if (cWith === 4) return { text: 'a straight', tier: 'strong' }
    if (cWith === 3) {
      const set = h1.rank === h2.rank
      return withDraws(set ? 'a set' : 'trips', set ? 'monster' : 'strong', draws)
    }
  }

  // ---- pairs / two pair (hero must contribute) ----
  if (h1.rank === h2.rank) {
    const p = rankIndex(h1.rank)
    if (board.some((c) => c.rank === h1.rank)) return withDraws('a set', 'monster', draws)
    if (p < topBoard) return withDraws('an overpair', 'strong', draws)
    return withDraws('an underpair', draws.length ? 'draw' : 'weak', draws)
  }
  const matchedRanks = [h1.rank, h2.rank].filter((r) => board.some((c) => c.rank === r))
  if (matchedRanks.length >= 2) return withDraws('two pair', 'strong', draws)
  if (matchedRanks.length === 1) {
    const m = rankIndex(matchedRanks[0])
    if (m === topBoard) return withDraws('top pair', 'top', draws)
    if (m === botBoard) return withDraws('bottom pair', 'weak', draws)
    return withDraws('middle pair', 'weak', draws)
  }

  if (draws.length) return { text: draws.join(' and '), tier: 'draw' }
  return { text: 'no pair and no draw (air)', tier: 'air' }
}
