import { dealHandForLabel, gridLabels, parseCards, type Card } from './cards'
import {
  isRfiHand,
  POSITION_LABEL,
  RFI_POSITIONS,
  RFI_RANGES,
  type Position,
  type RfiPosition,
} from '../data/ranges'
import { MATCHUPS, respond, type Matchup } from '../data/vsRfi'
import { MULTIWAY_MATCHUPS, respondMultiway } from '../data/multiway'
import { ALL_NODES as ALL_STREET_NODES, FLOP_NODES, nodeLabels, strategyFor, turnNodesForFlop, type StreetNode } from '../data/postflop'
import { describeHand } from './flopEval'

export type Action = 'fold' | 'raise' | 'call' | '3bet' | 'check' | 'bet' | 'squeeze' | 'cold-4bet'
export type DrillMode = 'rfi' | 'vsRfi' | 'multiway' | 'postflop'

export const ACTION_LABEL: Record<Action, string> = {
  fold: 'Fold',
  raise: 'Raise',
  call: 'Call',
  '3bet': '3-Bet',
  check: 'Check',
  bet: 'Bet',
  squeeze: 'Squeeze',
  'cold-4bet': '4-Bet',
}

/** A single decision the player is asked to make. */
export interface Spot {
  mode: DrillMode
  heroPos: Position
  raiserPos?: RfiPosition
  cards: [Card, Card]
  label: string
  correct: Action
  actions: Action[]
  category: HandCategory
  // postflop
  board?: Card[]
  node?: StreetNode
  freqs?: number[]
  // multi-street continuation
  handState?: HandState
}

/** Tracks a running postflop hand across streets so the user can continue. */
export interface HandState {
  heroCards: [Card, Card]
  heroLabel: string
  flopNode: StreetNode
  history: string[]
  street: 'flop' | 'turn' | 'river'
  /** Full board so far */
  board: Card[]
  /** Action hero took on flop */
  heroFlopAction?: Action
}

const ALL_LABELS: string[] = Array.from(new Set(gridLabels().flat()))
const randOf = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export interface GenOptions {
  /** Continue an in-progress postflop hand instead of dealing fresh. */
  state?: HandState
  /** Bias the dealt spot toward these hand categories (adaptive drilling). */
  focus?: Set<HandCategory>
}

// ---------- generators -------------------------------------------------------

export function generateSpot(mode: DrillMode, opts: GenOptions = {}): Spot {
  if (mode === 'postflop' && opts.state) return continueHand(opts.state)
  // Adaptive focus: reject-sample for a spot in a weak category.
  if (opts.focus && opts.focus.size) {
    for (let i = 0; i < 18; i++) {
      const s = generateOne(mode)
      if (opts.focus.has(s.category)) return s
    }
  }
  return generateOne(mode)
}

function generateOne(mode: DrillMode): Spot {
  if (mode === 'postflop') return generatePostflopSpot()
  if (mode === 'multiway') return generateMultiwaySpot()
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

// ---------- spot seeds (for the review queue) -------------------------------

export interface SpotSeed {
  mode: DrillMode
  heroPos: Position
  raiserPos?: RfiPosition
  label: string
  /** board string for postflop, e.g. "Qs7h2c" */
  board?: string
}

export function seedOf(spot: Spot): SpotSeed {
  return {
    mode: spot.mode,
    heroPos: spot.heroPos,
    raiserPos: spot.raiserPos,
    label: spot.label,
    board: spot.node?.board,
  }
}

export const seedKey = (s: SpotSeed): string =>
  `${s.mode}|${s.heroPos}|${s.raiserPos ?? ''}|${s.label}|${s.board ?? ''}`

/** Recreate a concrete spot from a seed (e.g. when reviewing a past mistake). */
export function spotFromSeed(seed: SpotSeed): Spot | null {
  const { mode, label } = seed
  if (mode === 'rfi') {
    const heroPos = seed.heroPos as RfiPosition
    const cards = dealHandForLabel(label)
    return {
      mode,
      heroPos,
      cards,
      label,
      correct: isRfiHand(heroPos, label) ? 'raise' : 'fold',
      actions: ['fold', 'raise'],
      category: classifyHand(label),
    }
  }
  if (mode === 'vsRfi') {
    const m = MATCHUPS.find((x) => x.raiser === seed.raiserPos && x.hero === seed.heroPos)
    if (!m) return null
    return {
      mode,
      heroPos: m.hero,
      raiserPos: m.raiser,
      cards: dealHandForLabel(label),
      label,
      correct: respond(m, label) as Action,
      actions: ['fold', 'call', '3bet'],
      category: classifyHand(label),
    }
  }
  if (mode === 'multiway') {
    const m = MULTIWAY_MATCHUPS.find((x) => x.hero === seed.heroPos)
    if (!m) return null
    return {
      mode,
      heroPos: m.hero,
      cards: dealHandForLabel(label),
      label,
      correct: respondMultiway(m, label) as Action,
      actions: m.actions as Action[],
      category: classifyHand(label),
    }
  }
  // postflop
  const node = ALL_STREET_NODES.find((n) => n.board === seed.board)
  if (!node) return null
  const board = boardCards(node)
  const strat = strategyFor(node, label)
  if (!strat) return null
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: dealHandForLabel(label, board),
    label,
    correct: strat.primary.startsWith('bet') ? 'bet' : 'check',
    actions: ['check', 'bet'],
    category: classifyHand(label),
    board,
    node,
    freqs: strat.freqs,
  }
}

function generatePostflopSpot(): Spot {
  const node = randOf(FLOP_NODES)
  const board = boardCards(node)
  const label = randOf(nodeLabels(node))
  const cards = dealHandForLabel(label, board)
  const strat = strategyFor(node, label)!
  const correct: Action = strat.primary.startsWith('bet') ? 'bet' : 'check'
  const handState: HandState = {
    heroCards: cards,
    heroLabel: label,
    flopNode: node,
    history: [...node.history, `Flop: ${node.board.match(/../g)!.join(' ')}`],
    street: 'flop',
    board,
  }
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
    handState,
  }
}

/** After answering a flop decision, advance to a turn node with the same cards. */
export function buildContinuationSpot(state: HandState, heroAction: Action): Spot | null {
  const flop = state.flopNode.board // 6 chars
  const turnNodes = turnNodesForFlop(flop)
  if (!turnNodes.length) return null
  const node = randOf(turnNodes)
  const turnCard = parseCards(node.board.slice(6))[0]
  const board = [...state.board, turnCard]
  const strat = strategyFor(node, state.heroLabel)
  if (!strat) return null
  const correct: Action = strat.primary.startsWith('bet') ? 'bet' : 'check'
  const actionVerb = heroAction === 'bet' ? 'BTN bets 1.8bb, BB calls' : 'BTN checks back'
  const newHistory = [
    ...state.history,
    `BB checks`,
    actionVerb,
    `Turn: ${node.board.slice(6)}`,
  ]
  const newState: HandState = {
    ...state,
    history: newHistory,
    street: 'turn',
    board,
    heroFlopAction: heroAction,
  }
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct,
    actions: ['check', 'bet'],
    category: classifyHand(state.heroLabel),
    board,
    node,
    freqs: strat.freqs,
    handState: newState,
  }
}

function continueHand(state: HandState): Spot {
  // If we're on flop, advance to turn; otherwise deal a fresh hand
  const flop = state.flopNode.board
  const turnNodes = turnNodesForFlop(flop)
  if (!turnNodes.length) return generatePostflopSpot()
  const node = randOf(turnNodes)
  const turnCard = parseCards(node.board.slice(6))[0]
  const board = [...state.board, turnCard]
  const strat = strategyFor(node, state.heroLabel) ?? strategyFor(node, randOf(nodeLabels(node)))!
  const correct: Action = strat.primary.startsWith('bet') ? 'bet' : 'check'
  const newState: HandState = { ...state, street: 'turn', board }
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct,
    actions: ['check', 'bet'],
    category: classifyHand(state.heroLabel),
    board,
    node,
    freqs: strat.freqs,
    handState: newState,
  }
}

function generateMultiwaySpot(): Spot {
  const label = randOf(ALL_LABELS)
  const cards = dealHandForLabel(label)
  const m = randOf(MULTIWAY_MATCHUPS)
  const correct = respondMultiway(m, label) as Action
  return {
    mode: 'multiway',
    heroPos: m.hero,
    cards,
    label,
    correct,
    actions: m.actions as Action[],
    category: classifyHand(label),
  }
}

const boardCards = (node: StreetNode): Card[] => {
  const cards: Card[] = []
  const s = node.board
  for (let i = 0; i + 1 < s.length; i += 2) cards.push(parseCards(s.slice(i, i + 2))[0])
  return cards
}

// ---------- judgement --------------------------------------------------------

export type Quality = 'correct' | 'acceptable' | 'wrong'

export interface Judgement {
  /** correct OR acceptable both count as "right" for streaks and leak stats. */
  isCorrect: boolean
  quality: Quality
  chosen: Action
  correct: Action
  explanation: string
}

/** Threshold: a mixed action played at >= this frequency is not a mistake. */
const ACCEPTABLE_FREQ = 0.3

export function judge(spot: Spot, chosen: Action): Judgement {
  let quality: Quality
  if (chosen === spot.correct) {
    quality = 'correct'
  } else if (spot.mode === 'postflop' && spot.freqs) {
    // postflop is a 2-action node: check=freqs[0], bet=freqs[1]
    const chosenFreq = chosen === 'check' ? spot.freqs[0] : spot.freqs[1]
    quality = chosenFreq >= ACCEPTABLE_FREQ ? 'acceptable' : 'wrong'
  } else {
    quality = 'wrong'
  }
  return {
    isCorrect: quality !== 'wrong',
    quality,
    chosen,
    correct: spot.correct,
    explanation: explain(spot, chosen),
  }
}

function explain(spot: Spot, chosen: Action): string {
  if (spot.mode === 'rfi') return explainRfi(spot, chosen)
  if (spot.mode === 'vsRfi') return explainVsRfi(spot, chosen)
  if (spot.mode === 'multiway') return explainMultiway(spot, chosen)
  return explainPostflop(spot, chosen)
}

function explainPostflop(spot: Spot, chosen: Action): string {
  const checkPct = Math.round((spot.freqs?.[0] ?? 0) * 100)
  const betPct = 100 - checkPct
  const board = spot.board!
  const street = spot.node?.street ?? 'flop'
  const desc = describeHand(spot.cards, board)
  const mixed = checkPct > 15 && checkPct < 85
  const chosenFreq = chosen === 'check' ? checkPct : betPct
  const verdict =
    chosen === spot.correct
      ? `Correct: GTO ${spot.correct === 'bet' ? 'bets' : 'checks'} ${spot.label} most often here.`
      : chosenFreq >= ACCEPTABLE_FREQ * 100
        ? `Fine: ${chosen === 'bet' ? 'betting' : 'checking'} is played ${chosenFreq}% here, so it's a defensible mixed choice.`
        : `Not the top play: the solver ${spot.correct === 'bet' ? 'bets' : 'checks back'} ${spot.label} more often.`
  const streetNote = street === 'turn' ? ' on the turn' : ' on this flop'
  const reason: Record<typeof desc.tier, string> = {
    monster: `You have ${desc.text}${streetNote}, a near-lock. Bet to build the pot.`,
    strong: `You have ${desc.text}${streetNote}. Bet for value and to charge worse hands.`,
    top: `You have ${desc.text}${streetNote}. Usually a bet for value and protection.`,
    draw: `You have ${desc.text}${streetNote}. Betting as a semi-bluff adds fold equity.`,
    weak: `You have ${desc.text}${streetNote}. Often a check to realise equity cheaply.`,
    air: `You have ${desc.text}${streetNote}. Check back or use as an occasional bluff.`,
  }
  const freq = `Solver mix: bet ${betPct}% / check ${checkPct}%.${mixed ? ' Genuinely mixed: both are fine, lean to the majority.' : ''}`
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
  const verdict = right ? `Correct: GTO ${verb} this hand here.` : `Not GTO: the solver ${verb} ${spot.label} from ${pos}.`
  return `${verdict} ${base} ${positionWhy(pos, inRange)}`
}

function explainVsRfi(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const raiser = spot.raiserPos!
  const heroName = POSITION_LABEL[spot.heroPos]
  const correctLabel = ACTION_LABEL[spot.correct].toLowerCase()
  const reason: Partial<Record<Action, string>> = {
    '3bet': `${spot.label} is strong enough (or a good bluff candidate) to 3-bet for value/pressure against a ${raiser} open.`,
    call: `${spot.label} plays well as a flat call here. Enough equity and playability to continue, but not strong enough to 3-bet.`,
    fold: `${spot.label} is too weak to continue profitably against a ${raiser} open from the ${heroName}; fold and wait.`,
  }
  const verdict = right
    ? `Correct: GTO ${correctLabel}s here.`
    : `Not GTO: facing a ${raiser} open, the solver ${correctLabel}s ${spot.label} from the ${heroName}.`
  const closing =
    spot.heroPos === 'BB'
      ? 'In the big blind you get a price to defend wide, but the weakest hands still fold.'
      : spot.heroPos === 'SB'
        ? 'Out of position from the small blind, prefer 3-betting over flatting to avoid tough spots postflop.'
        : 'In position you can flat more hands and realize equity with the betting lead behind you.'
  return `${verdict} ${reason[spot.correct] ?? ''} ${closing}`
}

function explainMultiway(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const m = MULTIWAY_MATCHUPS.find((x) => x.hero === spot.heroPos)!
  const correctLabel = ACTION_LABEL[spot.correct].toLowerCase()
  const verdict = right
    ? `Correct: GTO ${correctLabel}s ${spot.label} here.`
    : `Not GTO: the solver ${correctLabel}s ${spot.label} in this spot.`
  const context = m
    ? `Spot: ${m.description} Pot is ~${m.pot}bb.`
    : ''
  const why: Partial<Record<Action, string>> = {
    squeeze: `${spot.label} is strong enough to squeeze. You're getting extra value from the caller's dead money and isolating one player instead of playing multiway.`,
    call: `${spot.label} has the equity to call but isn't strong enough to squeeze profitably here. Take the price and see the flop.`,
    fold: `${spot.label} is too weak to continue in a multiway pot or against the ranges in this spot.`,
    'cold-4bet': `${spot.label} is strong enough to 4-bet for value here. You represent a very tight range and get maximum value.`,
  }
  return `${verdict} ${context} ${why[spot.correct] ?? ''}`
}

function positionWhy(pos: RfiPosition, inRange: boolean): string {
  if (pos === 'UTG' || pos === 'HJ') {
    return inRange
      ? 'Early position needs strong hands because up to four players can wake up with a better hand behind you.'
      : 'With many players left to act, marginal hands lose too often out of position. Discipline early pays off.'
  }
  if (pos === 'CO') {
    return inRange
      ? 'The cutoff can open wider: only the button and blinds are left, so you steal often and play in position.'
      : 'Even in the cutoff this hand is too weak to open profitably against the players behind.'
  }
  if (pos === 'BTN') {
    return inRange
      ? 'On the button you act last on every street, so you can profitably open almost half your hands.'
      : 'This is near the very bottom of hands: even the button folds the weakest holdings.'
  }
  return inRange
    ? 'From the small blind you only have the big blind to get through, so you raise a wide, aggressive range.'
    : 'Out of position post-flop, the small blind still folds its weakest hands rather than bloat the pot.'
}

// ---------- hand categories --------------------------------------------------

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
