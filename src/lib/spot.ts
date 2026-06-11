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
import {
  ALL_NODES as ALL_STREET_NODES,
  FLOP_NODES,
  hasRiver,
  nodeLabels,
  riverNodesForBoard,
  strategyFor,
  turnNodesForFlop,
  type StreetNode,
} from '../data/postflop'
import { describeHand, type Tier } from './flopEval'
import { randomFreeplayNode, freeplayStrategy, heroSeatOf, nodeLabels as fpLabels, facedBetBb } from '../data/freeplay'
import type { Level } from './level'

export type Action = 'fold' | 'raise' | 'call' | '3bet' | 'check' | 'bet' | 'bet33' | 'bet75' | 'squeeze' | 'cold-4bet'
export type DrillMode = 'rfi' | 'vsRfi' | 'multiway' | 'postflop'

export const ACTION_LABEL: Record<Action, string> = {
  fold: 'Fold',
  raise: 'Raise',
  call: 'Call',
  '3bet': '3-Bet',
  check: 'Check',
  bet: 'Bet',
  bet33: 'Bet ⅓',
  bet75: 'Bet ¾',
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
  /** Which multiway matchup this spot is (heroes are not unique, so we need the id). */
  matchupId?: string
  // postflop
  board?: Card[]
  node?: StreetNode
  freqs?: number[]
  // multi-street continuation
  handState?: HandState
  /** Set when the villain has bet into hero (fish donk) — fold/call/raise spot. */
  facingBet?: { amountBb: number }
  /** Second-best answers for heuristic (facing-bet) spots. */
  acceptable?: Action[]
  // all-seats Freeplay (single solver-true spots, any seat / node type)
  freeplay?: boolean
  /** Street + betting line for rendering when there's no continuation handState. */
  street?: 'flop' | 'turn' | 'river'
  history?: string[]
}

/** Who the continuation opponent is: solver-perfect, or a loose live-game fish. */
export type VillainStyle = 'gto' | 'fish'

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
  /** Continuation opponent style (defaults to gto). */
  villain?: VillainStyle
  /** Amount the villain bet into hero on the current street, when they did. */
  facedBet?: number
}

const ALL_LABELS: string[] = Array.from(new Set(gridLabels().flat()))
const randOf = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export type Difficulty = 'easy' | 'all' | 'hard'

export interface GenOptions {
  /** Continue an in-progress postflop hand instead of dealing fresh. */
  state?: HandState
  /** Bias the dealt spot toward these hand categories (adaptive drilling). */
  focus?: Set<HandCategory>
  /** Bias toward clear-cut (easy) or borderline (hard) decisions. */
  difficulty?: Difficulty
  /** Pin an RFI spot to one position (beginner lessons). */
  lockPos?: RfiPosition
  /** Pin a vs-RFI spot to one matchup (beginner lessons). */
  lockMatchup?: { raiser: RfiPosition; hero: Position }
}

/**
 * A targeted-drill request: "drill this specific leak". Produced by the Leaks
 * report and the hand-history importer, consumed by the DrillScreen, which
 * switches mode and biases the deal toward the leaky spot.
 */
export interface FocusRequest {
  /** Drill mode to switch to (defaults to 'rfi'). */
  mode?: DrillMode
  /** Bias the deal toward these hand categories. */
  cats?: HandCategory[]
  /** Pin RFI spots to one position (drills a leaky seat). */
  lockPos?: RfiPosition
  /** Launch Continuation (full-hand) play instead of a single-spot drill. */
  fullHand?: boolean
  /** Short human label for the focus banner, e.g. "UTG opens" or "Suited aces". */
  label?: string
}

// How many of the 5 RFI positions open each hand (0 = always fold, 5 = always
// open). 1–4 means the right answer is position-dependent → a harder decision.
const MARGINALITY: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  for (const label of ALL_LABELS) {
    let c = 0
    for (const p of RFI_POSITIONS) if (isRfiHand(p, label)) c++
    m[label] = c
  }
  return m
})()

function difficultyOK(spot: Spot, level: Difficulty): boolean {
  if (level === 'all') return true
  if (spot.mode === 'postflop' && spot.freqs) {
    const maxFreq = Math.max(spot.freqs[0], spot.freqs[1])
    return level === 'easy' ? maxFreq >= 0.78 : maxFreq <= 0.7
  }
  const m = MARGINALITY[spot.label] ?? 0
  return level === 'easy' ? m === 0 || m === 5 : m >= 1 && m <= 4
}

// ---------- generators -------------------------------------------------------

export function generateSpot(mode: DrillMode, opts: GenOptions = {}): Spot {
  if (mode === 'postflop' && opts.state) return continueHand(opts.state)
  const wantFocus = !!opts.focus?.size
  const wantDiff = !!opts.difficulty && opts.difficulty !== 'all'
  if (wantFocus || wantDiff) {
    const ok = (s: Spot) =>
      (!wantFocus || opts.focus!.has(s.category)) && (!wantDiff || difficultyOK(s, opts.difficulty!))
    for (let i = 0; i < 30; i++) {
      const s = generateOne(mode, opts)
      if (ok(s)) return s
    }
  }
  return generateOne(mode, opts)
}

function generateOne(mode: DrillMode, opts: GenOptions = {}): Spot {
  if (mode === 'postflop') return generatePostflopSpot()
  if (mode === 'multiway') return generateMultiwaySpot()
  const label = randOf(ALL_LABELS)
  const cards = dealHandForLabel(label)
  if (mode === 'rfi') {
    const heroPos = opts.lockPos ?? randOf(RFI_POSITIONS)
    const correct: Action = isRfiHand(heroPos, label) ? 'raise' : 'fold'
    return { mode, heroPos, cards, label, correct, actions: ['fold', 'raise'], category: classifyHand(label) }
  }
  // vsRfi
  const m =
    (opts.lockMatchup &&
      MATCHUPS.find((x) => x.raiser === opts.lockMatchup!.raiser && x.hero === opts.lockMatchup!.hero)) ||
    randOf(MATCHUPS)
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
  /** multiway matchup id */
  matchupId?: string
}

export function seedOf(spot: Spot): SpotSeed {
  return {
    mode: spot.mode,
    heroPos: spot.heroPos,
    raiserPos: spot.raiserPos,
    label: spot.label,
    board: spot.node?.board,
    matchupId: spot.matchupId,
  }
}

export const seedKey = (s: SpotSeed): string =>
  `${s.mode}|${s.heroPos}|${s.raiserPos ?? ''}|${s.label}|${s.board ?? ''}|${s.matchupId ?? ''}`

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
    const m = MULTIWAY_MATCHUPS.find((x) => x.id === seed.matchupId) ?? MULTIWAY_MATCHUPS.find((x) => x.hero === seed.heroPos)
    if (!m) return null
    return {
      mode,
      heroPos: m.hero,
      cards: dealHandForLabel(label),
      label,
      correct: respondMultiway(m, label) as Action,
      actions: m.actions as Action[],
      category: classifyHand(label),
      matchupId: m.id,
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
    correct: strat.primary as Action,
    actions: node.actions as Action[],
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
  const correct = strat.primary as Action
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
    actions: node.actions as Action[],
    category: classifyHand(label),
    board,
    node,
    freqs: strat.freqs,
    handState,
  }
}

// ---- the fish: a loose live-game villain for Continuation -------------------

/** How often the fish leads (donk-bets) into hero, per street. */
const FISH_DONK: Record<HandState['street'], number> = { flop: 0.3, turn: 0.35, river: 0.4 }
/** Fish lead size in bb (~half pot at our fixed pot sizes). */
const FISH_BET: Record<HandState['street'], number> = { flop: 2.7, turn: 4.5, river: 7.5 }

/**
 * Exploit grading vs a fish who bets far too often and rarely folds: raise big
 * hands for value, bluff-catch pairs, take the price with draws, never bluff.
 */
export function gradeVsDonk(tier: Tier, street: HandState['street']): { correct: Action; acceptable: Action[] } {
  if (tier === 'monster' || tier === 'strong') return { correct: 'raise', acceptable: ['call'] }
  if (tier === 'top') return { correct: 'call', acceptable: ['raise'] }
  if (tier === 'weak') return { correct: 'call', acceptable: ['fold'] }
  if (tier === 'draw')
    return street === 'river' ? { correct: 'fold', acceptable: [] } : { correct: 'call', acceptable: [] }
  return { correct: 'fold', acceptable: [] } // air
}

/** Build a "BB leads into you" spot for the given street node. */
function makeFacingBetSpot(node: StreetNode, board: Card[], state: HandState): Spot {
  const amountBb = FISH_BET[state.street]
  const facedState: HandState = { ...state, facedBet: amountBb }
  const { correct, acceptable } = gradeVsDonk(describeHand(state.heroCards, board).tier, state.street)
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct,
    acceptable,
    actions: ['fold', 'call', 'raise'],
    category: classifyHand(state.heroLabel),
    board,
    node,
    facingBet: { amountBb },
    handState: facedState,
  }
}

const fishDonks = (state: HandState): boolean => state.villain === 'fish' && Math.random() < FISH_DONK[state.street]

/**
 * Continuation play: hero opened the button preflop and BB called — deal the
 * flop using the hero's existing hole cards, on a board that doesn't collide
 * with them. Returns null if the hand isn't in the BTN c-bet range (no data).
 */
export function advanceToFlop(heroLabel: string, heroCards: [Card, Card], villain: VillainStyle = 'gto'): Spot | null {
  const used = new Set(heroCards.map((c) => c.rank + c.suit))
  const candidates = FLOP_NODES.filter(
    (n) => !!strategyFor(n, heroLabel) && boardCards(n).every((c) => !used.has(c.rank + c.suit)),
  )
  if (!candidates.length) return null
  const node = randOf(candidates)
  const board = boardCards(node)
  const strat = strategyFor(node, heroLabel)!
  const handState: HandState = {
    heroCards,
    heroLabel,
    flopNode: node,
    history: [...node.history, `Flop: ${node.board.match(/../g)!.join(' ')}`],
    street: 'flop',
    board,
    villain,
  }
  if (fishDonks(handState)) return makeFacingBetSpot(node, board, handState)
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: heroCards,
    label: heroLabel,
    correct: strat.primary as Action,
    actions: node.actions as Action[],
    category: classifyHand(heroLabel),
    board,
    node,
    freqs: strat.freqs,
    handState,
  }
}

/** Whether a continuation hand can proceed from preflop to the flop. */
export function canStartFlop(heroLabel: string, heroCards: [Card, Card]): boolean {
  const used = new Set(heroCards.map((c) => c.rank + c.suit))
  return FLOP_NODES.some((n) => !!strategyFor(n, heroLabel) && boardCards(n).every((c) => !used.has(c.rank + c.suit)))
}

const boardStr = (cards: Card[]): string => cards.map((c) => c.rank + c.suit).join('')

/**
 * All-seats Freeplay: one solver-true spot from a random seat / node type
 * (IP c-bet, OOP donk, or OOP facing a c-bet). Returns null until the all-seats
 * dataset is solved + installed, so callers fall back to current behaviour.
 */
export function generateFreeplaySpot(): Spot | null {
  const node = randomFreeplayNode()
  if (!node) return null
  const board = node.board.match(/../g)!.map((c) => parseCards(c)[0])
  const label = randOf(fpLabels(node))
  const cards = dealHandForLabel(label, board)
  const strat = freeplayStrategy(node, label)
  if (!strat) return null
  const facing = node.kind === 'face_cbet'
  return {
    mode: 'postflop',
    heroPos: heroSeatOf(node) as Position,
    cards,
    label,
    correct: strat.primary as Action,
    actions: node.actions as Action[],
    category: classifyHand(label),
    board,
    freqs: strat.freqs,
    freeplay: true,
    street: node.street,
    history: node.history,
    facingBet: facing ? { amountBb: facedBetBb(node.street) } : undefined,
  }
}

/** After answering a flop or turn decision, advance to the next street. */
export function buildContinuationSpot(state: HandState, heroAction: Action): Spot | null {
  if (heroAction === 'fold') return null // hero folded to a lead — hand over
  if (state.street === 'flop') return advanceToTurn(state, heroAction)
  if (state.street === 'turn') return advanceToRiver(state, heroAction)
  return null
}

/** History lines for how the street just played out (villain line + hero line). */
function streetResolution(state: HandState, heroAction: Action): string[] {
  if (state.facedBet) {
    const lead = `BB bets ${state.facedBet}bb`
    return heroAction === 'raise' ? [lead, 'BTN raises, BB calls'] : [lead, 'BTN calls']
  }
  const verb =
    heroAction === 'check'
      ? 'BTN checks back'
      : heroAction === 'bet75'
        ? 'BTN bets big, BB calls'
        : 'BTN bets, BB calls'
  return ['BB checks', verb]
}

function advanceToTurn(state: HandState, heroAction: Action): Spot | null {
  const flop = state.flopNode.board // 6 chars
  const turnNodes = turnNodesForFlop(flop).filter((n) => strategyFor(n, state.heroLabel))
  if (!turnNodes.length) return null
  // prefer a turn that also has river data, so the hand can run to the river
  const riverCapable = turnNodes.filter((n) => hasRiver(n.board))
  const node = randOf(riverCapable.length ? riverCapable : turnNodes)
  const turnCard = parseCards(node.board.slice(6))[0]
  const board = [...state.board, turnCard]
  const strat = strategyFor(node, state.heroLabel)!
  const newState: HandState = {
    ...state,
    history: [...state.history, ...streetResolution(state, heroAction), `Turn: ${node.board.slice(6)}`],
    street: 'turn',
    board,
    heroFlopAction: heroAction,
    facedBet: undefined,
  }
  if (fishDonks(newState)) return makeFacingBetSpot(node, board, newState)
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct: strat.primary as Action,
    actions: node.actions as Action[],
    category: classifyHand(state.heroLabel),
    board,
    node,
    freqs: strat.freqs,
    handState: newState,
  }
}

function advanceToRiver(state: HandState, heroAction: Action): Spot | null {
  const turnBoard = boardStr(state.board) // 8 chars
  const rivers = riverNodesForBoard(turnBoard).filter((n) => strategyFor(n, state.heroLabel))
  if (!rivers.length) return null
  const node = randOf(rivers)
  const riverCard = parseCards(node.board.slice(8))[0]
  const board = [...state.board, riverCard]
  const strat = strategyFor(node, state.heroLabel)!
  const newState: HandState = {
    ...state,
    history: [...state.history, ...streetResolution(state, heroAction), `River: ${node.board.slice(8)}`],
    street: 'river',
    board,
    facedBet: undefined,
  }
  if (fishDonks(newState)) return makeFacingBetSpot(node, board, newState)
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct: strat.primary as Action,
    actions: node.actions as Action[],
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
  const correct = strat.primary as Action
  const newState: HandState = { ...state, street: 'turn', board }
  return {
    mode: 'postflop',
    heroPos: node.hero,
    cards: state.heroCards,
    label: state.heroLabel,
    correct,
    actions: node.actions as Action[],
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
    matchupId: m.id,
  }
}

/** The multiway matchup a spot belongs to (by id — heroes are not unique). */
export const multiwayOf = (spot: Spot) => MULTIWAY_MATCHUPS.find((x) => x.id === spot.matchupId)

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

export function judge(spot: Spot, chosen: Action, level: Level = 'intermediate'): Judgement {
  let quality: Quality
  if (chosen === spot.correct) {
    quality = 'correct'
  } else if (spot.freqs) {
    // solver frequencies (postflop sizes, or a GTO fold/call/raise spot): score
    // by the chosen action's own frequency so a defensible mix is acceptable.
    const idx = spot.actions.indexOf(chosen)
    const chosenFreq = idx >= 0 ? (spot.freqs[idx] ?? 0) : 0
    quality = chosenFreq >= ACCEPTABLE_FREQ ? 'acceptable' : 'wrong'
  } else if (spot.facingBet) {
    // heuristic exploit spot (vs fish) — graded by tier, not solver frequencies
    quality = spot.acceptable?.includes(chosen) ? 'acceptable' : 'wrong'
  } else {
    quality = 'wrong'
  }
  return {
    isCorrect: quality !== 'wrong',
    quality,
    chosen,
    correct: spot.correct,
    explanation: explain(spot, chosen, level),
  }
}

const FP_VERB: Partial<Record<Action, string>> = {
  fold: 'fold',
  call: 'call',
  raise: 'raise',
  check: 'check',
  bet33: 'bet small (⅓)',
  bet75: 'bet big (¾)',
}

/** GTO explanation for an all-seats Freeplay spot — reports the solver's mix. */
function explainFreeplay(spot: Spot, chosen: Action): string {
  const desc = describeHand(spot.cards, spot.board!)
  const right = chosen === spot.correct
  const mix = spot.actions
    .map((a, i) => ({ a, p: spot.freqs?.[i] ?? 0 }))
    .filter((x) => x.p >= 0.05)
    .map((x) => `${FP_VERB[x.a] ?? x.a} ${Math.round(x.p * 100)}%`)
    .join(' · ')
  const verdict = right ? 'Correct.' : `Solver leans to ${FP_VERB[spot.correct] ?? 'this'}.`
  return `${verdict} With ${desc.text}, GTO plays ${mix}.`
}

function explain(spot: Spot, chosen: Action, level: Level): string {
  if (spot.freeplay) return explainFreeplay(spot, chosen)
  if (spot.facingBet) return explainFacingBet(spot, chosen, level)
  if (level === 'beginner') {
    if (spot.mode === 'rfi') return explainRfiBeginner(spot, chosen)
    if (spot.mode === 'vsRfi') return explainVsRfiBeginner(spot, chosen)
    if (spot.mode === 'multiway') return explainMultiwayBeginner(spot, chosen)
    return explainPostflopBeginner(spot, chosen)
  }
  if (spot.mode === 'rfi') return explainRfi(spot, chosen)
  if (spot.mode === 'vsRfi') return explainVsRfi(spot, chosen)
  if (spot.mode === 'multiway') return explainMultiway(spot, chosen)
  return explainPostflop(spot, chosen)
}

/** Exploit coaching for a fish lead: value-raise big, bluff-catch pairs, never bluff. */
function explainFacingBet(spot: Spot, chosen: Action, level: Level): string {
  const desc = describeHand(spot.cards, spot.board!)
  const right = chosen === spot.correct
  const ok = spot.acceptable?.includes(chosen)
  const verdict = right
    ? 'Correct.'
    : ok
      ? `Reasonable — but ${ACTION_LABEL[spot.correct].toLowerCase()} is better here.`
      : `The better play is to ${ACTION_LABEL[spot.correct].toLowerCase()}.`
  const why: Record<Action, string> = {
    raise: `You hold ${desc.text}. A loose player bets far too many weak hands — raise for value and let them pay you off; slow-playing only lets worse hands off cheap.`,
    call: `You hold ${desc.text}. It beats much of a loose bettor's wild range, so don't fold — but raising folds out their bluffs and only gets called by better. Call and let them keep barreling.`,
    fold: `You hold ${desc.text}. Even a loose bettor has you beat here often enough, and bluff-raising a player who never folds just burns money. Let it go.`,
  } as Record<Action, string>
  const body = why[spot.correct] ?? `You hold ${desc.text}.`
  if (level === 'beginner') {
    const simple: Partial<Record<Action, string>> = {
      raise: `You have ${desc.text} — a big hand. This player bets too often with weak cards, so raise and make them pay.`,
      fold: `You have ${desc.text}. That's not enough to continue against a bet, and bluffing a player who never folds doesn't work. Fold.`,
      call: `You have ${desc.text} — good enough to [call] a loose player's bet, but not big enough to raise. Calling keeps their weaker hands in.`,
    }
    return `${verdict} ${simple[spot.correct] ?? body}`
  }
  return `${verdict} ${body}`
}

// ---------- beginner copy (plain language, [term] glossary markers) ----------

/** Prompt shown above the action buttons, phrased for the chosen level. */
export function promptFor(spot: Spot, level: Level): string {
  const street = spot.handState?.street
  const mwDesc = multiwayOf(spot)?.description ?? 'What do you do?'
  if (spot.facingBet) {
    const st = spot.street ?? street
    const where = st === 'river' ? ' on the river' : st === 'turn' ? ' on the turn' : ''
    return level === 'beginner'
      ? `They bet ${spot.facingBet.amountBb}bb into you${where}. Fold, call, or raise?`
      : `Facing a ${spot.facingBet.amountBb}bb bet${where}. Fold, call, or raise?`
  }
  if (spot.freeplay) {
    const st = spot.street ?? 'flop'
    if (spot.heroPos === 'BB') return `You're out of position on the ${st}, first to act. Bet or check?`
    return `BB checks to you on the ${st}. Bet, or check back?`
  }
  if (level === 'beginner') {
    if (spot.mode === 'rfi') return 'Everyone folded to you. Raise this hand, or fold?'
    if (spot.mode === 'vsRfi') return `The ${POSITION_LABEL[spot.raiserPos!]} raised. Fold, call, or 3-bet?`
    if (spot.mode === 'multiway') return mwDesc
    return street === 'river'
      ? 'They checked the river to you. Bet, or check it back?'
      : street === 'turn'
        ? 'They checked the turn to you. Bet, or check it back?'
        : 'They checked to you. Bet, or check it back?'
  }
  if (spot.mode === 'rfi') return 'Folded to you. Open-raise or fold?'
  if (spot.mode === 'vsRfi') return `${spot.raiserPos} raises. Fold, call, or 3-bet?`
  if (spot.mode === 'multiway') return mwDesc
  return street === 'river'
    ? 'BB checks the river. Bet or check back?'
    : street === 'turn'
      ? 'BB checks the turn. Bet or check back?'
      : 'BB checks. Bet or check back?'
}

/** One-line "what to think about" nudge (beginner pre-answer hint). */
export function hintFor(spot: Spot): string {
  if (spot.facingBet)
    return 'They bet into you. Raise big hands for [value], [call] with pairs and [draw]s, fold air — and never [bluff] a player who refuses to fold.'
  if (spot.mode === 'rfi')
    return 'Is this hand strong enough to [open] from this seat? Later [position] lets you play more hands.'
  if (spot.mode === 'vsRfi')
    return 'Is it strong enough to [3-bet], good enough to [call], or better to fold?'
  if (spot.mode === 'multiway')
    return 'Is this hand strong enough to [squeeze], or should you stay out of a multiway pot?'
  return 'Do you have enough to bet for [value] or as a [semi-bluff], or is this a [check]?'
}

function explainRfiBeginner(spot: Spot, chosen: Action): string {
  const pos = spot.heroPos as RfiPosition
  const posName = POSITION_LABEL[pos]
  const inRange = spot.correct === 'raise'
  const right = chosen === spot.correct
  const verdict = right ? 'Correct.' : `The better play is to ${inRange ? 'raise' : 'fold'}.`
  const body = inRange
    ? `${spot.label} is strong enough to [open] from the ${posName}. Raising pressures the [blinds] and lets you play the pot with the lead.`
    : `${spot.label} is too weak to [open] from the ${posName}. Fold it and wait for a better hand.`
  return `${verdict} ${body}`
}

function explainVsRfiBeginner(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const heroName = POSITION_LABEL[spot.heroPos]
  const verdict = right ? 'Correct.' : `The better play is to ${ACTION_LABEL[spot.correct].toLowerCase()}.`
  const why: Partial<Record<Action, string>> = {
    '3bet': `${spot.label} is strong enough to [3-bet] (re-raise) for [value] or pressure.`,
    call: `${spot.label} is good enough to [call] and see a flop, but not strong enough to [3-bet].`,
    fold: `${spot.label} is too weak to continue from the ${heroName}. Fold and wait.`,
  }
  return `${verdict} ${why[spot.correct] ?? ''}`
}

function explainMultiwayBeginner(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const verdict = right ? 'Correct.' : `The better play is to ${ACTION_LABEL[spot.correct].toLowerCase()}.`
  const why: Partial<Record<Action, string>> = {
    squeeze: `${spot.label} is strong enough to [squeeze]: re-raise over the raiser and caller to win the pot now.`,
    '3bet': `${spot.label} is strong enough to [3-bet] (re-raise) the opener.`,
    call: `${spot.label} can [call] and see a flop, but is not strong enough to raise.`,
    fold: `${spot.label} is too weak to continue here. Fold.`,
    'cold-4bet': `${spot.label} is strong enough to re-raise big ([4-bet]) for [value].`,
  }
  return `${verdict} ${why[spot.correct] ?? ''}`
}

function explainPostflopBeginner(spot: Spot, chosen: Action): string {
  const board = spot.board!
  const desc = describeHand(spot.cards, board)
  const right = chosen === spot.correct
  const betWord = spot.correct === 'bet75' ? 'bet bigger (¾ pot)' : spot.correct === 'bet33' ? 'bet small (⅓ pot)' : 'bet'
  const verdict = right ? 'Correct.' : `The better play is usually to ${spot.correct === 'check' ? 'check' : betWord}.`
  const reason: Record<typeof desc.tier, string> = {
    monster: `You have ${desc.text}, a huge hand. Bet for [value] to build the pot.`,
    strong: `You have ${desc.text}. Bet for [value] to get called by worse hands.`,
    top: `You have ${desc.text}. Usually a [value] bet for protection.`,
    draw: `You have ${desc.text}. Betting as a [semi-bluff] gives you two ways to win.`,
    weak: `You have ${desc.text}. Often a [check] to see another card cheaply.`,
    air: `You have ${desc.text}. [Check] and give up, or bet now and then as a [bluff].`,
  }
  return `${verdict} ${reason[desc.tier]}`
}

// ---------- strategic-depth helpers ------------------------------------------

const RANK_SEQ = 'AKQJT98765432'
const rk = (r: string) => RANK_SEQ.indexOf(r)

/** A short clause describing a starting hand's strategic character. */
function handCharacter(label: string): string {
  const cat = classifyHand(label)
  const hi = label[0]
  const lo = label[1]
  const suited = label.endsWith('s')
  const wheelAce = suited && hi === 'A' && '2345'.includes(lo)
  switch (cat) {
    case 'Pocket pair':
      return rk(hi) <= rk('Q')
        ? 'It is a premium pair with a big equity edge and the initiative.'
        : rk(hi) <= rk('8')
          ? 'It is a middling pair that flops sets and keeps useful showdown value.'
          : 'It is a small pair that plays mainly for set value, so it wants cheap flops and position.'
    case 'Suited ace':
      return wheelAce
        ? 'A suited wheel ace brings nut-flush and wheel potential plus an ace blocker, so it doubles as a strong semi-bluff.'
        : 'A suited ace has nut-flush potential and blocks the strongest hands.'
    case 'Offsuit ace':
      return 'An offsuit ace has high-card strength but is dominated by better aces, so it needs position to play well.'
    case 'Suited broadway':
      return 'Two big suited cards flop strong top pairs and nut draws.'
    case 'Offsuit broadway':
      return 'Two big offsuit cards have solid high-card value but less postflop playability than the suited version.'
    case 'Suited connector':
      return 'A suited connector adds straight and flush equity that realises well in position.'
    case 'Suited gapper':
      return 'A one-gap suited hand keeps straight and flush potential with slightly less connectivity.'
    case 'Suited other':
      return 'A speculative suited hand that leans on flush equity and position.'
    default:
      return 'An offsuit, disconnected hand flops weak and plays poorly out of position.'
  }
}

/** Heuristic: is a 3-bet of this hand primarily for value (true) or a bluff (false)? */
function isValue3Bet(label: string): boolean {
  if (classifyHand(label) === 'Pocket pair') return rk(label[0]) <= rk('T') // TT+
  return label === 'AKs' || label === 'AKo' || label === 'AQs'
}

/** Board-texture + range-dynamic note for the postflop spots (button vs big blind). */
function boardTexture(board: Card[], street: 'flop' | 'turn' | 'river'): string {
  if (street === 'turn')
    return 'By the turn ranges are narrower, so bets polarise toward clear value and the best draws while medium hands check to keep the pot small.'
  if (street === 'river')
    return 'On the river the hand is decided, so play is polarised: bet your value hands and chosen bluffs (ideally with blockers) and check the rest to bluff-catch.'
  const flop = board.slice(0, 3)
  const suits = new Set(flop.map((c) => c.suit)).size
  const hi = flop.map((c) => 14 - rk(c.rank))
  const top = Math.max(...hi)
  const paired = new Set(flop.map((c) => c.rank)).size < 3
  const sorted = [...hi].sort((a, b) => b - a)
  const connected = !paired && sorted[0] - sorted[2] <= 4
  if (top >= 12 && !connected && !paired && suits >= 2)
    return 'This dry, high flop favours the button (the raiser), so the textbook line is a small c-bet of about a third pot at a high frequency for thin value and equity denial.'
  if (paired)
    return 'Paired flops make strong hands rarer for both players, so the raiser leans on range advantage with a cheap bet and gives up little by checking back.'
  if (suits === 1 || connected || top <= 9)
    return "This wetter or lower flop connects better with the big blind's calling range, shrinking the raiser's edge, so it is checked more and bets are more selective."
  return 'On a neutral flop the raiser keeps a small range edge and mixes a small c-bet with checks.'
}

// Phrasings for the postflop actions (check / bet⅓ / bet¾, plus legacy bet).
const POST_PHRASE: Partial<Record<Action, string>> = {
  check: 'check back',
  bet: 'bet',
  bet33: 'bet small (⅓)',
  bet75: 'bet big (¾)',
}
const POST_MIX: Partial<Record<Action, string>> = { check: 'check', bet: 'bet', bet33: 'bet ⅓', bet75: 'bet ¾' }

function explainPostflop(spot: Spot, chosen: Action): string {
  const board = spot.board!
  const street = spot.node?.street ?? 'flop'
  const desc = describeHand(spot.cards, board)
  const freqs = spot.freqs ?? []
  const pct = (a: Action) => {
    const i = spot.actions.indexOf(a)
    return i >= 0 ? Math.round((freqs[i] ?? 0) * 100) : 0
  }
  const chosenPct = pct(chosen)
  const correctPct = pct(spot.correct)
  const topFreq = Math.max(...spot.actions.map((a) => pct(a)))
  const phrase = (a: Action) => POST_PHRASE[a] ?? 'play this'
  const verdict =
    chosen === spot.correct
      ? `Correct: ${phrase(spot.correct)} is the solver's top choice (${correctPct}%).`
      : chosenPct >= ACCEPTABLE_FREQ * 100
        ? `Fine: ${phrase(chosen)} is played ${chosenPct}% here — a defensible mixed choice.`
        : `Not the top play: the solver prefers to ${phrase(spot.correct)} (${correctPct}%).`
  const streetNote = street === 'river' ? ' on the river' : street === 'turn' ? ' on the turn' : ' on this flop'
  const reason: Record<typeof desc.tier, string> = {
    monster: `You have ${desc.text}${streetNote}, a near-lock that wants to build the pot.`,
    strong: `You have ${desc.text}${streetNote}, a strong made hand that mostly bets for value.`,
    top: `You have ${desc.text}${streetNote}, a solid one-pair hand with real showdown value.`,
    draw: `You have ${desc.text}${streetNote}, a draw that can semi-bluff for fold equity or check to realise it.`,
    weak: `You have ${desc.text}${streetNote}, a marginal made hand with modest showdown value.`,
    air: `You have ${desc.text}${streetNote}, with little showdown value, so it works as a check or a bluff.`,
  }
  // a sizing note only when the correct play is a specific bet size
  const sizeNote =
    spot.correct === 'bet33'
      ? ' The small size lets the button bet a wide range thinly and cheaply.'
      : spot.correct === 'bet75'
        ? ' The bigger size is for polarised spots — strong value plus the bluffs that want fold equity.'
        : ''
  const mix = spot.actions.map((a) => `${POST_MIX[a] ?? a} ${pct(a)}%`).join(' / ')
  const mixed = topFreq < 85 ? ' Genuinely mixed — lean to the majority.' : ''
  return `${verdict} ${reason[desc.tier]}${sizeNote} ${boardTexture(board, street)} Solver mix: ${mix}.${mixed}`
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
  return `${verdict} ${base} ${handCharacter(spot.label)} ${positionWhy(pos, inRange)}`
}

function explainVsRfi(spot: Spot, chosen: Action): string {
  const right = chosen === spot.correct
  const raiser = spot.raiserPos!
  const heroName = POSITION_LABEL[spot.heroPos]
  const correctLabel = ACTION_LABEL[spot.correct].toLowerCase()
  const isIP = spot.heroPos === 'BTN' || spot.heroPos === 'CO'
  const reason: Partial<Record<Action, string>> = {
    '3bet': isValue3Bet(spot.label)
      ? `${spot.label} 3-bets for value: it is ahead of a ${raiser} continuing range, so you build the pot now and charge their draws and worse pairs.`
      : `${spot.label} is a 3-bet bluff: it blocks the opener's premiums (an ace or broadway card removes some of their AA/AK), keeps backup equity, and folds out better hands often enough to profit.`,
    call: `Flatting keeps a ${raiser} opener's dominated and bluffing hands in the pot. ${spot.label} has the equity and playability to continue${isIP ? ' in position' : ' for a price'}, but 3-betting would mostly fold out the hands you already beat${isIP ? '' : ' and bloat the pot out of position'}.`,
    fold: `${spot.label} is dominated by a ${raiser} opening range and realises equity poorly${isIP ? '' : ' out of position'}; calling bleeds chips through reverse implied odds, so the ${heroName} folds.`,
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
  const m = multiwayOf(spot)
  const correctLabel = ACTION_LABEL[spot.correct].toLowerCase()
  const verdict = right
    ? `Correct: GTO ${correctLabel}s ${spot.label} here.`
    : `Not GTO: the solver ${correctLabel}s ${spot.label} in this spot.`
  const context = m
    ? `Spot: ${m.description} Pot is ~${m.pot}bb.`
    : ''
  const oop = spot.heroPos === 'SB' || spot.heroPos === 'BB'
  const why: Partial<Record<Action, string>> = {
    squeeze: `${spot.label} is strong enough to squeeze. With a caller already in there is dead money to attack: size up to charge the field, deny their equity, and take the pot heads-up with the lead.`,
    '3bet': isValue3Bet(spot.label)
      ? `${spot.label} 3-bets the opener for value: you are ahead of their continuing range and want chips in now.`
      : `${spot.label} is a 3-bet bluff against the opener: its blockers and backup equity make a clean semi-bluff.`,
    call: `${spot.label} can call but is not strong enough to raise. Multiway you need hands that flop nutty (pairs for sets, suited and connected cards for strong draws), so take the price and proceed carefully.`,
    fold: `${spot.label} is too weak for a multiway pot: it is dominated by the ranges still in and realises little equity against several opponents${oop ? ' out of position' : ''}.`,
    'cold-4bet': `${spot.label} 4-bets for value: against a 3-betting range you represent a very tight, nutted range, and your blockers cut into the hands that could continue.`,
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
