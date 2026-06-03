// 6-max, 100bb cash. Raise-First-In (RFI) ranges — folded to hero.
// These are solver-APPROXIMATE published ranges, good enough for a beginner
// tutor. The exact-solver corpus (incl. postflop) is the parallel data track.

import { expandRange } from '../lib/cards'

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'
export type RfiPosition = Exclude<Position, 'BB'>

// Physical/betting order around the table (preflop action order).
export const POSITION_ORDER: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
export const RFI_POSITIONS: RfiPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB']

export const POSITION_LABEL: Record<Position, string> = {
  UTG: 'Under the Gun',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
}

interface RangeDef {
  pct: number // approximate % of hands opened
  tokens: string[]
}

const RFI_DEFS: Record<RfiPosition, RangeDef> = {
  UTG: {
    pct: 16,
    tokens: ['22+', 'A2s+', 'KTs+', 'QTs+', 'J9s+', 'T9s', '98s', '87s', '76s', '65s', 'ATo+', 'KJo+', 'QJo'],
  },
  HJ: {
    pct: 21,
    tokens: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'A9o+', 'KTo+', 'QTo+', 'JTo'],
  },
  CO: {
    pct: 28,
    tokens: ['22+', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '64s+', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo', 'T9o'],
  },
  BTN: {
    pct: 47,
    tokens: ['22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '85s+', '74s+', '63s+', '53s+', '43s', 'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o', '98o'],
  },
  SB: {
    pct: 42,
    tokens: ['22+', 'A2s+', 'K5s+', 'Q7s+', 'J7s+', 'T7s+', '96s+', '85s+', '74s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
  },
}

export interface RfiRange {
  pct: number
  hands: Set<string>
}

export const RFI_RANGES: Record<RfiPosition, RfiRange> = Object.fromEntries(
  RFI_POSITIONS.map((p) => [p, { pct: RFI_DEFS[p].pct, hands: expandRange(RFI_DEFS[p].tokens) }]),
) as Record<RfiPosition, RfiRange>

/** Is `label` an open (raise) at this position? */
export function isRfiHand(pos: RfiPosition, label: string): boolean {
  return RFI_RANGES[pos].hands.has(label)
}

/** Index of a position in preflop action order (lower = acts earlier). */
export function actionIndex(pos: Position): number {
  return POSITION_ORDER.indexOf(pos)
}
