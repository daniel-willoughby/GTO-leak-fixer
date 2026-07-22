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

// Human-facing rank text. Internally a ten is the single char 'T' (so keys,
// parsing and range data stay two-chars-per-card); only the display reads "10".
export const rankLabel = (r: string): string => (r === 'T' ? '10' : r)

// Display form of a hand-grid label ("T9s" → "109s", "TT" → "1010"). Only the
// 'T' rank is rewritten; the suited/offsuit suffix is lowercase so it's untouched.
export const prettyHandLabel = (label: string): string => label.replace(/T/g, '10')

/** Canonical 169-hand label for two cards, e.g. "AKs", "AKo", "77". */
export function handLabel(a: Card, b: Card): string {
  const [hi, lo] = rankIndex(a.rank) <= rankIndex(b.rank) ? [a, b] : [b, a]
  if (hi.rank === lo.rank) return `${hi.rank}${lo.rank}`
  const suited = a.suit === b.suit ? 's' : 'o'
  return `${hi.rank}${lo.rank}${suited}`
}

/**
 * Suit-aware strategy key for a specific two-card combo on a specific board.
 *
 * The solver aggregates strategy per 169-class, which is right on a rainbow
 * board but wrong on a flushy one: it would average a made flush in with the
 * non-flush combos of the same rank class (8h7h on a monotone heart board is
 * not 87s). The corpus therefore sub-buckets those by the board's flush suit,
 * keyed "<169>|<boardSuitCount><holeSuitCount>", and this recomputes that key
 * from the dealt cards.
 *
 * MUST match `suitAwareLabel` in solver-spike/solve-rich.mjs and
 * transform-allseats.mjs exactly, including the 's','h','d','c' scan order that
 * breaks ties. Boards with no suit appearing twice get no suffix, i.e. the
 * plain 169 label.
 */
export function suitAwareLabel(hole: [Card, Card], board: Card[]): string {
  const base = handLabel(hole[0], hole[1])
  if (!board.length) return base
  const counts: Partial<Record<Suit, number>> = {}
  for (const c of board) counts[c.suit] = (counts[c.suit] ?? 0) + 1
  const holeSuits = [hole[0].suit, hole[1].suit]
  let best: { b: number; h: number; tot: number } | null = null
  for (const s of SUITS) {
    const b = counts[s] ?? 0
    if (b < 2) continue // this suit cannot make a flush
    const h = holeSuits.filter((x) => x === s).length
    const tot = b + h
    if (!best || tot > best.tot) best = { b, h, tot }
  }
  return best ? `${base}|${best.b}${best.h}` : base
}

/** Strip any suit-aware suffix back to the plain 169 label ("87s|32" → "87s"). */
export const baseLabel = (key: string): string => (key.includes('|') ? key.slice(0, key.indexOf('|')) : key)

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

/**
 * Deal a concrete hand for `label`, avoiding any cards in `exclude`.
 *
 * `rand` defaults to Math.random. Pass a seeded generator where every client
 * must deal the SAME combo: with suit-aware strategy the exact suits can change
 * the solver's answer on a flushy board (a made flush plays nothing like the
 * other suited combos of its class), so the daily ladder can no longer leave
 * this to chance.
 */
export function dealHandForLabel(label: string, exclude: Card[] = [], rand: () => number = Math.random): [Card, Card] {
  const combos = combosForLabel(label)
  const valid = combos.filter(([a, b]) => !exclude.some((e) => sameCard(e, a) || sameCard(e, b)))
  const pool = valid.length ? valid : combos
  return pool[Math.floor(rand() * pool.length)]
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

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const BOARD_CODE = /^([2-9TJQKA][shdc]){3,5}$/

/**
 * Pretty-print a raw board code for display, separating the flop from later
 * streets: "Qs8s4s2c" → "Q♠ 8♠ 4♠ · 2♣". Returns non-board strings unchanged
 * (the leak tracker mixes board keys with positions and hand types).
 */
export function formatBoardCode(code: string): string {
  if (!BOARD_CODE.test(code)) return code
  const cards = code.match(/../g)!.map((c) => `${rankLabel(c[0])}${SUIT_GLYPH[c[1]]}`)
  const flop = cards.slice(0, 3).join(' ')
  return cards.length === 3 ? flop : `${flop} · ${cards.slice(3).join(' ')}`
}
