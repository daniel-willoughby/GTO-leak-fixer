// Hand replay: turn a postflop spot into a short animated build-up ("how the
// hand got here") that plays on the poker table before the decision appears.
// Everyone folds around to the opener, the open + call go in, the board runs
// out street by street with the betting, and we stop at the hero's decision.
//
// Pure + data-driven: buildReplay(spot) -> ReplayFrame[]; the table renders one
// frame at a time. Enabled on web too (a deliberate exception to iOS-only) so it
// can be tested in the browser.
import { POSITION_ORDER, actionIndex, type Position } from '../data/ranges'
import type { Card } from './cards'
import type { Spot } from './spot'
import type { Chip, ReplayFrame } from '../components/PokerTable'

type SeatStatus = ReplayFrame['seatStatus'][Position]

const REPLAY_KEY = 'lt-replay'
const SPEED_KEY = 'lt-replay-speed'

export function replayEnabled(): boolean {
  try {
    return localStorage.getItem(REPLAY_KEY) !== '0'
  } catch {
    return true
  }
}
export function setReplayEnabled(on: boolean): void {
  try {
    localStorage.setItem(REPLAY_KEY, on ? '1' : '0')
  } catch {
    /* storage disabled — non-fatal */
  }
}

/** Replay pacing: 'low' is the relaxed default, 'high' runs at 2x. */
export type ReplaySpeed = 'low' | 'high'

export function replaySpeed(): ReplaySpeed {
  try {
    return localStorage.getItem(SPEED_KEY) === 'high' ? 'high' : 'low'
  } catch {
    return 'low'
  }
}
export function setReplaySpeed(s: ReplaySpeed): void {
  try {
    localStorage.setItem(SPEED_KEY, s)
  } catch {
    /* storage disabled — non-fatal */
  }
}
/** Divide frame holds by this to apply the speed setting. */
export const replaySpeedFactor = (): number => (replaySpeed() === 'high' ? 2 : 1)

const amountOf = (line: string): number | null => {
  const m = line.match(/([\d.]+)\s*bb/)
  return m ? parseFloat(m[1]) : null
}
const isStreetMarker = (line: string) => /^(Flop|Turn|River):/i.test(line)
const labelOf = (line: string, actor: Position) =>
  line.startsWith(actor) ? line.slice(actor.length).trim() : line

/**
 * Build the replay frames for a postflop spot, or null when a replay doesn't
 * apply (no board, or no history to reconstruct).
 */
export function buildReplay(spot: Spot): ReplayFrame[] | null {
  const board = spot.handState?.board ?? spot.board
  const history = spot.handState?.history ?? spot.history
  if (!board || board.length < 3 || !history || history.length === 0) return null

  const hero = spot.heroPos
  const villain = spot.villainPos ?? (hero === 'BB' ? 'BTN' : 'BB')

  // opener / caller: prefer the preflop history lines, else infer from position
  // order (earlier position opens, later — usually the BB — calls).
  const firstStreet = history.findIndex(isStreetMarker)
  const preflopLines = firstStreet === -1 ? history : history.slice(0, firstStreet)
  const openLine = preflopLines.find((l) => /opens|raises/i.test(l))
  const parsedOpener = openLine ? (openLine.split(/\s+/)[0] as Position) : null
  const opener = parsedOpener && POSITION_ORDER.includes(parsedOpener)
    ? parsedOpener
    : actionIndex(hero) < actionIndex(villain) ? hero : villain
  const caller = opener === hero ? villain : hero
  const openAmt = (openLine && amountOf(openLine)) || 2.5

  const inHand = new Set<Position>([hero, villain])
  const folded = new Set<Position>()
  const frames: ReplayFrame[] = []
  const chips = new Map<Position, Chip>()
  // Like real poker: bets sit in front of players during a street; the central
  // pot only reflects money from COMPLETED streets. It sweeps in at each street
  // change, so the pot doesn't tick up live with every bet.
  let potCommitted = 0
  const sweep = () => {
    potCommitted += [...chips.values()].reduce((s, c) => s + c.amount, 0)
    chips.clear()
  }
  let streetBet = 0
  let seq = 0

  const statusMap = (actor?: Position, actorStatus: SeatStatus = 'active'): Record<Position, SeatStatus> => {
    const out = {} as Record<Position, SeatStatus>
    for (const p of POSITION_ORDER) {
      out[p] =
        p === hero ? 'hero'
        : folded.has(p) ? 'folded'
        : p === actor ? actorStatus
        : inHand.has(p) ? 'active'
        : 'waiting'
    }
    return out
  }
  const push = (action?: ReplayFrame['action'], actor?: Position) => {
    frames.push({
      seatStatus: statusMap(actor, action?.anim === 'muck' ? 'folded' : 'active'),
      chips: [...chips.values()],
      pot: Math.round(potCommitted * 10) / 10,
      board: [...boardShown],
      action,
      seq: seq++,
    })
  }

  let boardShown: Card[] = []

  // ---- preflop -------------------------------------------------------------
  // blinds posted
  chips.set('SB', { pos: 'SB', amount: 0.5, tone: 'blind' })
  chips.set('BB', { pos: 'BB', amount: 1, tone: 'blind' })
  push()

  // fold everyone acting before the opener (skip the eventual caller)
  const order = POSITION_ORDER
  for (const p of order) {
    if (p === opener) break
    if (p === caller || p === hero || p === villain) continue
    folded.add(p)
    push({ pos: p, label: 'folds', anim: 'muck' }, p)
  }
  // opener opens
  chips.set(opener, { pos: opener, amount: openAmt, tone: 'bet' })
  push({ pos: opener, label: `opens ${openAmt}bb`, anim: 'chips' }, opener)
  // fold everyone between opener and caller
  for (const p of order.slice(actionIndex(opener) + 1)) {
    if (p === caller) break
    if (p === hero || p === villain) continue
    folded.add(p)
    push({ pos: p, label: 'folds', anim: 'muck' }, p)
  }
  // caller calls
  chips.set(caller, { pos: caller, amount: openAmt, tone: 'bet' })
  push({ pos: caller, label: 'calls', anim: 'chips' }, caller)

  // ---- streets -------------------------------------------------------------
  const streetLines = firstStreet === -1 ? [] : history.slice(firstStreet)
  for (const line of streetLines) {
    if (isStreetMarker(line)) {
      // street change: sweep the completed round's bets into the central pot,
      // then deal the next board card(s)
      sweep()
      streetBet = 0
      const count = /^Flop/i.test(line) ? 3 : /^Turn/i.test(line) ? 4 : 5
      boardShown = board.slice(0, count)
      push()
      continue
    }
    const actor = line.split(/\s+/)[0] as Position
    if (!POSITION_ORDER.includes(actor)) continue
    const amt = amountOf(line)
    const isCheck = /check/i.test(line) && amt == null
    const isCall = /\bcalls?\b/i.test(line)
    if (isCheck) {
      push({ pos: actor, label: labelOf(line, actor) || 'checks', anim: 'check' }, actor)
    } else if (isCall) {
      chips.set(actor, { pos: actor, amount: streetBet, tone: 'bet' })
      push({ pos: actor, label: 'calls', anim: 'chips' }, actor)
    } else if (amt != null) {
      streetBet = amt
      chips.set(actor, { pos: actor, amount: amt, tone: 'bet' })
      push({ pos: actor, label: labelOf(line, actor), anim: 'chips' }, actor)
    }
  }

  // guarantee the board is fully shown for the decision (some histories omit a
  // trailing street marker when the villain's last action IS the decision cue)
  if (boardShown.length < board.length) {
    boardShown = [...board]
    frames[frames.length - 1] = { ...frames[frames.length - 1], board: [...boardShown] }
  }

  return frames.length > 1 ? frames : null
}
