// 6-max, 100bb cash. Raise-First-In (RFI) ranges, folded to hero.
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
  /**
   * Curated edge-mixing region: hands at the boundary of the range that GTO
   * opens only part of the time (raise frequency 0..1). These are *outside*
   * `tokens` (the pure-raise core); listing one here makes it a close,
   * partly-mixed decision instead of a clean raise/fold. Frequencies are
   * solver-approximate, the point is teaching that some opens are coin-flips.
   */
  mix?: Record<string, number>
}

const RFI_DEFS: Record<RfiPosition, RangeDef> = {
  UTG: {
    pct: 16,
    tokens: ['22+', 'A2s+', 'KTs+', 'QTs+', 'J9s+', 'T9s', '98s', '87s', '76s', '65s', 'ATo+', 'KJo+', 'QJo'],
    mix: { A9o: 0.4, A8o: 0.3, KTo: 0.5, K9s: 0.5, QTo: 0.4, JTo: 0.4, T9o: 0.3, '54s': 0.5 },
  },
  HJ: {
    pct: 21,
    tokens: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'A9o+', 'KTo+', 'QTo+', 'JTo'],
    mix: { K8s: 0.5, Q8s: 0.5, J8s: 0.5, T7s: 0.4, '64s': 0.5, A8o: 0.5, A7o: 0.35, K9o: 0.4, Q9o: 0.35, T9o: 0.4 },
  },
  CO: {
    pct: 28,
    tokens: ['22+', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '64s+', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo', 'T9o'],
    mix: { K6s: 0.5, K5s: 0.4, Q7s: 0.5, J7s: 0.5, T7s: 0.5, '53s': 0.5, '43s': 0.4, A6o: 0.5, A5o: 0.5, K9o: 0.5, Q9o: 0.4, J9o: 0.4, '98o': 0.4 },
  },
  BTN: {
    pct: 47,
    tokens: ['22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '85s+', '74s+', '63s+', '53s+', '43s', 'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o', '98o'],
    mix: { Q3s: 0.5, Q2s: 0.4, J5s: 0.5, T5s: 0.5, '95s': 0.5, '84s': 0.5, '73s': 0.4, '52s': 0.4, '42s': 0.3, K7o: 0.6, K6o: 0.4, Q8o: 0.5, J8o: 0.5, T8o: 0.5, '97o': 0.4, '87o': 0.4, '76o': 0.3 },
  },
  SB: {
    pct: 42,
    tokens: ['22+', 'A2s+', 'K5s+', 'Q7s+', 'J7s+', 'T7s+', '96s+', '85s+', '74s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
    mix: { K4s: 0.5, K3s: 0.4, K2s: 0.35, Q6s: 0.5, J6s: 0.5, T6s: 0.5, '95s': 0.4, '84s': 0.4, '63s': 0.4, '43s': 0.4, K8o: 0.5, Q8o: 0.4, J8o: 0.4, T8o: 0.4, '98o': 0.4, '87o': 0.3 },
  },
}

export interface RfiRange {
  pct: number
  hands: Set<string>
  /** Edge hands → raise frequency (0..1), outside the pure-raise `hands` core. */
  mix: Record<string, number>
}

export const RFI_RANGES: Record<RfiPosition, RfiRange> = Object.fromEntries(
  RFI_POSITIONS.map((p) => [
    p,
    { pct: RFI_DEFS[p].pct, hands: expandRange(RFI_DEFS[p].tokens), mix: RFI_DEFS[p].mix ?? {} },
  ]),
) as Record<RfiPosition, RfiRange>

/** Is `label` in the pure-raise opening core at this position? */
export function isRfiHand(pos: RfiPosition, label: string): boolean {
  return RFI_RANGES[pos].hands.has(label)
}

/**
 * Raise-first-in frequency for this hand at this seat (0..1). Pure-core hands
 * return 1, pure folds return 0, and curated edge hands return their mixed
 * open frequency. Use this for frequency-aware grading and grid fills.
 */
export function rfiFreq(pos: RfiPosition, label: string): number {
  const r = RFI_RANGES[pos]
  if (r.hands.has(label)) return 1
  return r.mix[label] ?? 0
}

/** Index of a position in preflop action order (lower = acts earlier). */
export function actionIndex(pos: Position): number {
  return POSITION_ORDER.indexOf(pos)
}
