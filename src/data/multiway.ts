// Multiway and 3-bet-pot preflop scenarios.
// Solver-approximate. These add squeeze spots and cold-call decisions to
// the drill pool so it's not all heads-up single-raised pots.

import { expandRange } from '../lib/cards'
import type { Position } from './ranges'

export type MultiwayAction = 'fold' | 'call' | '3bet' | 'squeeze' | 'cold-4bet'

// Aggressive (raising) actions, in label-preference order.
const AGGRO: MultiwayAction[] = ['squeeze', 'cold-4bet', '3bet']

export interface MultiwayMatchup {
  id: string
  description: string
  /** Seats still in: first is the original raiser, last may be a caller. */
  activeBefore: Position[]
  hero: Position
  pot: number // in bb, approximate
  actions: MultiwayAction[]
  /** Chips already in front of each seat (incl. blinds + hero's own posted bet). */
  bets: Partial<Record<Position, number>>
  squeeze: Set<string>
  call: Set<string>
  /** If empty, everything not in squeeze/call is a fold. */
}

const def = (tokens: string[]) => expandRange(tokens)

const MATCHUPS: Omit<MultiwayMatchup, 'squeeze' | 'call'>[] = [
  // UTG opens, HJ calls, CO squeezes or folds (no cold-call here)
  {
    id: 'UTG_open_HJ_call_CO_squeeze',
    description: 'UTG opens, HJ calls. CO: squeeze or fold?',
    activeBefore: ['UTG', 'HJ'],
    hero: 'CO',
    pot: 7.5,
    actions: ['fold', 'squeeze'],
    bets: { SB: 0.5, BB: 1, UTG: 2.5, HJ: 2.5 },
  },
  // CO opens, BTN calls, SB squeezes (SB is OOP so 3b-or-fold)
  {
    id: 'CO_open_BTN_call_SB_squeeze',
    description: 'CO opens, BTN calls. SB: squeeze or fold?',
    activeBefore: ['CO', 'BTN'],
    hero: 'SB',
    pot: 8.5,
    actions: ['fold', 'squeeze'],
    bets: { SB: 0.5, BB: 1, CO: 2.5, BTN: 2.5 },
  },
  // BTN opens, BB 3-bets, BTN cold-calls or 4-bets (BTN defends 3-bet)
  {
    id: 'BTN_open_BB_3bet_BTN_defend',
    description: 'BTN opens, BB 3-bets to 9bb. BTN: call or 4-bet?',
    activeBefore: ['BB'],
    hero: 'BTN',
    pot: 13.5,
    actions: ['fold', 'call', 'cold-4bet'],
    bets: { SB: 0.5, BTN: 2.5, BB: 9 },
  },
  // UTG opens, CO cold-calls or 3-bets (in position, vs tight range).
  // Heads-up vs a single open → the raise is a 3-bet, not a squeeze.
  {
    id: 'UTG_open_CO_cold',
    description: 'UTG opens. CO: call, 3-bet, or fold?',
    activeBefore: ['UTG'],
    hero: 'CO',
    pot: 6,
    actions: ['fold', 'call', '3bet'],
    bets: { SB: 0.5, BB: 1, UTG: 2.5 },
  },
  // HJ opens, CO calls, BTN squeezes or flats in position
  {
    id: 'HJ_open_CO_call_BTN_squeeze',
    description: 'HJ opens, CO calls. BTN: call, squeeze, or fold?',
    activeBefore: ['HJ', 'CO'],
    hero: 'BTN',
    pot: 7.5,
    actions: ['fold', 'call', 'squeeze'],
    bets: { SB: 0.5, BB: 1, HJ: 2.5, CO: 2.5 },
  },
  // CO opens, BTN 3-bets to 9bb, CO defends (call or 4-bet)
  {
    id: 'CO_open_BTN_3bet_CO_defend',
    description: 'CO opens, BTN 3-bets to 9bb. CO: call or 4-bet?',
    activeBefore: ['BTN'],
    hero: 'CO',
    pot: 13,
    actions: ['fold', 'call', 'cold-4bet'],
    bets: { SB: 0.5, BB: 1, CO: 2.5, BTN: 9 },
  },
  // UTG opens, BTN calls, BB squeezes from the blinds (OOP, 3bet-or-fold)
  {
    id: 'UTG_open_BTN_call_BB_squeeze',
    description: 'UTG opens, BTN calls. BB: squeeze or fold?',
    activeBefore: ['UTG', 'BTN'],
    hero: 'BB',
    pot: 7,
    actions: ['fold', 'squeeze'],
    bets: { SB: 0.5, BB: 1, UTG: 2.5, BTN: 2.5 },
  },
]

// Ranges (solver-approximate)
const RANGES: Record<string, { squeeze?: string[]; '3bet'?: string[]; call?: string[]; 'cold-4bet'?: string[] }> = {
  UTG_open_HJ_call_CO_squeeze: {
    squeeze: ['QQ+', 'AKs', 'AQs', 'AKo', 'A5s', 'KQs'],
    call: [],
  },
  CO_open_BTN_call_SB_squeeze: {
    squeeze: ['TT+', 'AQs+', 'AKo', 'A4s', 'A5s', 'KQs'],
    call: [],
  },
  BTN_open_BB_3bet_BTN_defend: {
    'cold-4bet': ['QQ+', 'AKs', 'AKo', 'A5s', 'A4s'],
    call: ['22-JJ', 'ATs+', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s', 'AQo', 'KQo'],
  },
  UTG_open_CO_cold: {
    '3bet': ['TT+', 'AQs+', 'AKo', 'A5s', 'KQs'],
    call: ['22-99', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', 'AQo', 'KQo'],
  },
  HJ_open_CO_call_BTN_squeeze: {
    squeeze: ['JJ+', 'AQs+', 'AKo', 'A5s', 'A4s', 'KQs'],
    call: ['22-TT', 'AJs', 'ATs', 'KJs', 'QJs', 'JTs', 'T9s', '98s', 'AQo', 'KQo'],
  },
  CO_open_BTN_3bet_CO_defend: {
    'cold-4bet': ['QQ+', 'AKs', 'AKo', 'A5s'],
    call: ['22-JJ', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s', 'AQo'],
  },
  UTG_open_BTN_call_BB_squeeze: {
    squeeze: ['JJ+', 'AKs', 'AQs', 'AKo', 'A5s', 'KQs'],
    call: [],
  },
}

export const MULTIWAY_MATCHUPS: MultiwayMatchup[] = MATCHUPS.map((m) => {
  const r = RANGES[m.id] ?? {}
  // `squeeze` holds the aggressive-raise hands, whether the matchup's raise is a
  // squeeze or a cold 4-bet, respondMultiway returns whichever the spot uses.
  return {
    ...m,
    squeeze: def([...(r.squeeze ?? []), ...(r['3bet'] ?? []), ...(r['cold-4bet'] ?? [])]),
    call: def(r.call ?? []),
  }
})

export function respondMultiway(m: MultiwayMatchup, label: string): MultiwayAction {
  // `squeeze` holds the aggressive-raise hands; return whichever raise this spot uses.
  if (m.squeeze.has(label)) return m.actions.find((a) => AGGRO.includes(a)) ?? 'squeeze'
  if (m.call.has(label)) return 'call'
  return 'fold'
}
