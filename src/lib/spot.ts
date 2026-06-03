import { dealHandForLabel, gridLabels, type Card } from './cards'
import {
  isRfiHand,
  POSITION_LABEL,
  RFI_POSITIONS,
  RFI_RANGES,
  type Position,
  type RfiPosition,
} from '../data/ranges'
import { MATCHUPS, respond, type Matchup } from '../data/vsRfi'
import { boardCards, FLOP_NODES, nodeLabels, strategyFor, type FlopNode } from '../data/postflop'
import { describeHand } from './flopEval'

export type Action = 'fold' | 'raise' | 'call' | '3bet' | 'check' | 'bet'
export type DrillMode = 'rfi' | 'vsRfi' | 'postflop'

export const ACTION_LABEL: Record<Action, string> = {
  fold: 'Fold',
  raise: 'Raise',
  call: 'Call',
  '3bet': '3-Bet',
  check: 'Check',
  bet: 'Bet',
}

export interface Spot {
  mode: DrillMode
  heroPos: Position
  raiserPos?: RfiPosition
  cards: [Card, Card]
  label: string
  correct: Action
  actions: Action[]
  category: HandCategory
  // postflop only
  board?: Card[]
  node?: FlopNode
  freqs?: number[] // index-aligned to node.actions
}

const ALL_LABELS: string[] = Array.from(new Set(gridLabels().flat()))
const randOf = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function generateSpot(mode: DrillMode): Spot {
  if (mode === 'postflop') return generatePostflopSpot()
  const label = randOf(ALL_LABELS)
  const cards = dealHandForLabel(label)
  if (mode === 'rfi') {
    const heroPos = randOf(RFI_POSITIONS)
    const correct: Action = isRfiHand(heroPos, label) ? 'raise' : 'fold'
    return { mode, heroPos, cards, label, correct, actions: ['fold', 'raise'], category: classifyHand(label) }
  }
  // vsRfi
  const m = randOf(MATCHUPS)
  const correct = respond(m, label) as Action
  return {
    mode,
    heroPos: m.hero,
    raiserPos: m.raiser,
    cards,
    label,
    correct,
    actions: ['fold', 'call', '3bet'],
    category: classifyHand(label),
  }
}

function generatePostflopSpot(): Spot {
  const node = randOf(FLOP_NODES)
  const board = boardCards(node)
  const label = randOf(nodeLabels(node))
  const cards = dealHandForLabel(label, board)
  const strat = strategyFor(node, label)!
  const correct: Action = strat.primary.startsWith('bet') ? 'bet' : 'check'
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards,
    label,
    correct,
    actions: ['check', 'bet'],
    category: classifyHand(label),
    board,
    node,
    freqs: strat.freqs,
  }
}

export interface Judgement {
  isCorrect: boolean
  chosen: Action
  correct: Action
  explanation: string
}

export function judge(spot: Spot, chosen: Action): Judgement {
  const isCorrect = chosen === spot.correct
  return { isCorrect, chosen, correct: spot.correct, explanation: explain(spot, chosen) }
}

function explain(spot: Spot, chosen: Action): string {
  if (spot.mode === 'rfi') return explainRfi(spot, chosen)
  if (spot.mode === 'vsRfi') return explainVsRfi(spot, chosen)
  return explainPostflop(spot, chosen)
}

function explainPostflop(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const checkPct = Math.round((spot.freqs?.[0] ?? 0) * 100)
  const betPct = 100 - checkPct
  const desc = describeHand(spot.cards, spot.board!)
  const mixed = checkPct > 15 && checkPct < 85

  const verdict = right
    ? `Correct — GTO ${spot.correct === 'bet' ? 'bets' : 'checks'} ${spot.label} most often here.`
    : `Not the top play — the solver ${spot.correct === 'bet' ? 'bets' : 'checks back'} ${spot.label} more often.`

  const reason: Record<typeof desc.tier, string> = {
    monster: `You have ${desc.text} — a near-lock. Bet to build the pot while villain can still pay you off.`,
    strong: `You have ${desc.text} — bet for value and to charge worse hands and draws.`,
    top: `You have ${desc.text} — usually a bet for value and protection on this board.`,
    draw: `You have ${desc.text} — betting as a semi-bluff adds fold equity on top of your outs.`,
    weak: `You have ${desc.text} — often a check to realise equity cheaply and keep villain's bluffs in.`,
    air: `You have ${desc.text} — check back the worst hands, or bet some as bluffs to balance.`,
  }

  const freq = `Solver mix: bet ${betPct}% / check ${checkPct}%.${mixed ? ' This is a genuinely mixed spot — both are fine, lean to the majority.' : ''}`

  return `${verdict} ${reason[desc.tier]} ${freq}`
}

function explainRfi(spot: Spot, chosen: Action): string {
  const pos = spot.heroPos as RfiPosition
  const range = RFI_RANGES[pos]
  const posName = POSITION_LABEL[pos]
  const inRange = spot.correct === 'raise'
  const verb = inRange ? 'opens' : 'folds'
  const right = chosen === spot.correct

  const base = inRange
    ? `${spot.label} is inside the ${posName} opening range (~${range.pct}% of hands). From ${pos} the GTO play is to raise first in.`
    : `${spot.label} is outside the ${posName} opening range (~${range.pct}% of hands). From ${pos} the GTO play is to fold and wait for a better spot.`

  const verdict = right
    ? `Correct — GTO ${verb} this hand here.`
    : `Not GTO — the solver ${verb} ${spot.label} from ${pos}.`

  return `${verdict} ${base} ${positionWhy(pos, inRange)}`
}

function explainVsRfi(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const raiser = spot.raiserPos!
  const heroName = POSITION_LABEL[spot.heroPos]
  const correctLabel = ACTION_LABEL[spot.correct].toLowerCase()

  const reason: Partial<Record<Action, string>> = {
    '3bet': `${spot.label} is strong enough (or a good bluff candidate) to 3-bet for value/pressure against a ${raiser} open.`,
    call: `${spot.label} plays well as a flat call here — enough equity and playability to continue, but not strong enough to 3-bet.`,
    fold: `${spot.label} is too weak to continue profitably against a ${raiser} open from the ${heroName}; fold and wait.`,
  }

  const verdict = right
    ? `Correct — GTO ${correctLabel}s here.`
    : `Not GTO — facing a ${raiser} open, the solver ${correctLabel}s ${spot.label} from the ${heroName}.`

  const closing =
    spot.heroPos === 'BB'
      ? 'In the big blind you get a price to defend wide, but the weakest hands still fold.'
      : spot.heroPos === 'SB'
        ? 'Out of position from the small blind, prefer 3-betting over flatting to avoid tough spots postflop.'
        : 'In position you can flat more hands and realize equity with the betting lead behind you.'

  return `${verdict} ${reason[spot.correct] ?? ''} ${closing}`
}

function positionWhy(pos: RfiPosition, inRange: boolean): string {
  if (pos === 'UTG' || pos === 'HJ') {
    return inRange
      ? 'Early position needs strong hands because up to four players can wake up with a better hand behind you.'
      : 'With many players left to act, marginal hands lose too often out of position — discipline early pays off.'
  }
  if (pos === 'CO') {
    return inRange
      ? 'The cutoff can open wider: only the button and blinds are left, so you steal often and play in position.'
      : 'Even in the cutoff this hand is too weak to open profitably against the players behind.'
  }
  if (pos === 'BTN') {
    return inRange
      ? 'On the button you act last on every street, so you can profitably open almost half your hands.'
      : 'This is near the very bottom of hands — even the button folds the weakest holdings.'
  }
  return inRange
    ? 'From the small blind you only have the big blind to get through, so you raise a wide, aggressive range.'
    : 'Out of position post-flop, the small blind still folds its weakest hands rather than bloat the pot.'
}

// ---- Hand categories for leak aggregation ----------------------------------

export type HandCategory =
  | 'Pocket pair'
  | 'Suited ace'
  | 'Offsuit ace'
  | 'Suited broadway'
  | 'Offsuit broadway'
  | 'Suited connector'
  | 'Suited gapper'
  | 'Suited other'
  | 'Offsuit other'

const BROADWAY = new Set(['A', 'K', 'Q', 'J', 'T'])

export function classifyHand(label: string): HandCategory {
  if (label.length === 2) return 'Pocket pair'
  const hi = label[0]
  const lo = label[1]
  const suited = label.endsWith('s')
  if (hi === 'A') return suited ? 'Suited ace' : 'Offsuit ace'
  if (BROADWAY.has(hi) && BROADWAY.has(lo)) return suited ? 'Suited broadway' : 'Offsuit broadway'
  if (suited) {
    const gap = 'AKQJT98765432'.indexOf(lo) - 'AKQJT98765432'.indexOf(hi)
    if (gap === 1) return 'Suited connector'
    if (gap === 2) return 'Suited gapper'
    return 'Suited other'
  }
  return 'Offsuit other'
}

export { type Matchup }
