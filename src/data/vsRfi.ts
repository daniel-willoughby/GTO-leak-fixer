// Facing a single raise (vs-RFI). Hero responds fold / call / 3-bet.
// Curated set of the most common 6-max matchups, solver-APPROXIMATE.
// Anything not in `threeBet` or `call` is a fold.

import { expandRange } from '../lib/cards'
import type { Position, RfiPosition } from './ranges'

interface MatchupDef {
  raiser: RfiPosition
  hero: Position
  threeBet: string[]
  call: string[]
}

const DEFS: MatchupDef[] = [
  // UTG opens, BB defends (closing, OOP, big discount → wide flat, tight 3bet)
  {
    raiser: 'UTG',
    hero: 'BB',
    threeBet: ['QQ+', 'AKs', 'AKo', 'A5s', 'KQs'],
    call: ['22-JJ', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', '87s', '76s', 'AQo', 'KQo'],
  },
  // HJ opens, BTN cold-calls IP
  {
    raiser: 'HJ',
    hero: 'BTN',
    threeBet: ['TT+', 'AQs+', 'AKo', 'A5s', 'KQs'],
    call: ['22-99', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', 'AQo', 'KQo'],
  },
  // CO opens, BTN IP
  {
    raiser: 'CO',
    hero: 'BTN',
    threeBet: ['99+', 'AJs+', 'AQo+', 'A4s', 'A5s', 'KJs+', 'KQo'],
    call: ['22-88', 'A9s+', 'K9s+', 'QTs+', 'J9s+', 'T9s', '98s', '87s', 'KJo', 'QJo', 'AJo'],
  },
  // CO opens, BB defends (wide)
  {
    raiser: 'CO',
    hero: 'BB',
    threeBet: ['TT+', 'AJs+', 'AKo', 'A4s', 'A5s', 'KQs'],
    call: ['22-99', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  },
  // BTN opens, SB (mostly 3bet-or-fold, small flat)
  {
    raiser: 'BTN',
    hero: 'SB',
    threeBet: ['66+', 'A8s+', 'ATo+', 'KTs+', 'KQo', 'QTs+', 'JTs', 'A4s', 'A5s', 'K9s'],
    call: ['22-55', 'ATs', 'AJs', 'KQs', 'QJs', 'JTs'],
  },
  // BTN opens, BB defends (very wide)
  {
    raiser: 'BTN',
    hero: 'BB',
    threeBet: ['77+', 'A8s+', 'KTs+', 'QTs+', 'JTs', 'ATo+', 'KJo+', 'A2s', 'A3s', 'A4s', 'A5s', 'K9s', 'Q9s'],
    call: ['22-66', 'A2s+', 'K2s+', 'Q5s+', 'J7s+', 'T7s+', '96s+', '85s+', '75s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
  },
  // SB opens, BB defends (BB is IP postflop → wide)
  {
    raiser: 'SB',
    hero: 'BB',
    threeBet: ['66+', 'A7s+', 'A9o+', 'KTs+', 'KJo+', 'QTs+', 'JTs', 'A2s', 'A3s', 'A4s', 'A5s', 'K9s'],
    call: ['22-55', 'A2s+', 'K2s+', 'Q6s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '65s', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo'],
  },
  // UTG opens, CO cold-calls / 3-bets in position vs a tight range
  {
    raiser: 'UTG',
    hero: 'CO',
    threeBet: ['QQ+', 'AKs', 'AQs', 'AKo', 'A5s'],
    call: ['22-JJ', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s', '98s', 'AQo', 'KQo'],
  },
  // HJ opens, BB defends (wide, closing OOP)
  {
    raiser: 'HJ',
    hero: 'BB',
    threeBet: ['TT+', 'AJs+', 'AKo', 'A4s', 'A5s', 'KQs'],
    call: ['22-99', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '76s', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  },
  // HJ opens, CO 3-bets / flats in position
  {
    raiser: 'HJ',
    hero: 'CO',
    threeBet: ['99+', 'AQs+', 'AKo', 'A5s', 'A4s', 'KQs', 'KJs'],
    call: ['22-88', 'AJs', 'ATs', 'KTs+', 'QJs', 'JTs', 'T9s', '98s', 'AQo', 'KQo'],
  },
  // CO opens, SB 3-bets-or-folds out of position (small flat)
  {
    raiser: 'CO',
    hero: 'SB',
    threeBet: ['77+', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'AJo+', 'KQo', 'A5s', 'A4s', 'A3s'],
    call: ['22-66', 'AJs', 'KQs', 'QJs', 'JTs', 'T9s'],
  },
]

export interface Matchup {
  raiser: RfiPosition
  hero: Position
  threeBet: Set<string>
  call: Set<string>
}

export const MATCHUPS: Matchup[] = DEFS.map((d) => ({
  raiser: d.raiser,
  hero: d.hero,
  threeBet: expandRange(d.threeBet),
  call: expandRange(d.call),
}))

export type VsRfiAction = 'fold' | 'call' | '3bet'

export function respond(m: Matchup, label: string): VsRfiAction {
  if (m.threeBet.has(label)) return '3bet'
  if (m.call.has(label)) return 'call'
  return 'fold'
}
