// Card + hand utilities for 6-max No-Limit Hold'em preflop work.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const
export type Rank = (typeof RANKS)[number]
export const SUITS = ['s', 'h', 'd', 'c'] as const
export type Suit = (typeof SUITS)[number]

export interface Card {
  rank: Rank
  suit: Suit
}

// rank index: A=0 (highest) .. 2=12 (lowest)
export const rankIndex = (r: Rank): number => RANKS.indexOf(r)

/** Canonical 169-hand label for two cards, e.g. "AKs", "AKo", "77". */
export function handLabel(a: Card, b: Card): string {
  const [hi, lo] = rankIndex(a.rank) <= rankIndex(b.rank) ? [a, b] : [b, a]
  if (hi.rank === lo.rank) return `${hi.rank}${lo.rank}`
  const suited = a.suit === b.suit ? 's' : 'o'
  return `${hi.rank}${lo.rank}${suited}`
}

/** Number of combos a 169-hand label represents (pair=6, suited=4, offsuit=12). */
export function comboCount(label: string): number {
  if (label.length === 2) return 6
  return label.endsWith('s') ? 4 : 12
}

/** Full 13x13 grid of labels, row = high card, col = low card. Suited above diagonal. */
export function gridLabels(): string[][] {
  return RANKS.map((r1, i) =>
    RANKS.map((r2, j) => {
      if (i === j) return `${r1}${r1}` // pair
      if (i < j) return `${r1}${r2}s` // suited (upper-right)
      return `${r2}${r1}o` // offsuit (lower-left)
    }),
  )
}

/** Every concrete two-card combo matching a 169-label (pair=6, suited=4, offsuit=12). */
export function combosForLabel(label: string): [Card, Card][] {
  const r1 = label[0] as Rank
  const r2 = label[1] as Rank
  const out: [Card, Card][] = []
  if (label.length === 2) {
    for (let i = 0; i < SUITS.length; i++)
      for (let j = i + 1; j < SUITS.length; j++)
        out.push([{ rank: r1, suit: SUITS[i] }, { rank: r2, suit: SUITS[j] }])
  } else if (label.endsWith('s')) {
    for (const s of SUITS) out.push([{ rank: r1, suit: s }, { rank: r2, suit: s }])
  } else {
    for (const s1 of SUITS)
      for (const s2 of SUITS) if (s1 !== s2) out.push([{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }])
  }
  return out
}

const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit

/** Deal a random concrete hand for `label`, avoiding any cards in `exclude`. */
export function dealHandForLabel(label: string, exclude: Card[] = []): [Card, Card] {
  const combos = combosForLabel(label)
  const valid = combos.filter(([a, b]) => !exclude.some((e) => sameCard(e, a) || sameCard(e, b)))
  const pool = valid.length ? valid : combos
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Parse a board string like "Qs7h2c" into cards. */
export function parseCards(str: string): Card[] {
  const out: Card[] = []
  for (let i = 0; i + 1 < str.length; i += 2) out.push({ rank: str[i] as Rank, suit: str[i + 1] as Suit })
  return out
}

// ---- Range notation expander ------------------------------------------------
// Understands: "22+", "55+", "ATs+", "A2s+", "KTo+", "T9s", "76o", "AKs"

function expandToken(token: string): string[] {
  // Pair range, e.g. "22-JJ" (inclusive, low to high)
  if (token.includes('-')) {
    const [a, b] = token.split('-')
    const loIdx = rankIndex(a[0] as Rank) // e.g. 22 → higher index
    const hiIdx = rankIndex(b[0] as Rank) // e.g. JJ → lower index
    const [from, to] = loIdx >= hiIdx ? [hiIdx, loIdx] : [loIdx, hiIdx]
    const out: string[] = []
    for (let i = from; i <= to; i++) out.push(`${RANKS[i]}${RANKS[i]}`)
    return out
  }

  const plus = token.endsWith('+')
  const t = plus ? token.slice(0, -1) : token

  // Pair, e.g. "22" / "TT"
  if (t.length === 2 && t[0] === t[1]) {
    if (!plus) return [t]
    const from = rankIndex(t[0] as Rank)
    const out: string[] = []
    for (let i = from; i >= 0; i--) out.push(`${RANKS[i]}${RANKS[i]}`)
    return out
  }

  // Suited/offsuit, e.g. "ATs", "KQo"
  const hi = t[0] as Rank
  const lo = t[1] as Rank
  const suit = t[2] // 's' | 'o'
  if (!plus) return [`${hi}${lo}${suit}`]

  const hiIdx = rankIndex(hi)
  const out: string[] = []
  // increase the lower (kicker) rank up to just under the high card
  for (let loIdx = rankIndex(lo); loIdx > hiIdx; loIdx--) {
    out.push(`${hi}${RANKS[loIdx]}${suit}`)
  }
  return out
}

export function expandRange(tokens: string[]): Set<string> {
  const set = new Set<string>()
  for (const tok of tokens) for (const h of expandToken(tok)) set.add(h)
  return set
}

export const cardStr = (c: Card): string => `${c.rank}${c.suit}`
