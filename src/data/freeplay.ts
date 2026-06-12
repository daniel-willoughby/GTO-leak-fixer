// All-seats Freeplay nodes, the rich variety extracted from the solver:
// IP c-bets, OOP donks, and OOP facing-a-c-bet (fold/call/raise) across the
// UTG/HJ/CO/BTN-vs-BB matchups.
//
// The dataset (~5 MB) lives in public/freeplay-nodes.json and is fetched at
// runtime rather than bundled — inlining it into the JS bundle is too big for
// the build, and lazy-loading keeps the initial app download small. Until the
// fetch resolves (or in tests, until setFreeplayNodes is called) the app falls
// back to its other Freeplay generators.
import type { RfiPosition } from './ranges'

export interface FreeplayNode {
  spot: string // e.g. 'CO_vs_BB_SRP'
  board: string // 6-char flop or 8-char turn
  street: 'flop' | 'turn'
  kind: 'cbet' | 'donk' | 'face_cbet'
  hero: 'IP' | 'OOP'
  facing: 'check' | 'bet'
  history: string[]
  betSizes: number[]
  actions: string[]
  strategy: Record<string, number[]>
}

// Mutable: starts empty (dormant) and is filled by loadFreeplayNodes() at app
// startup, or setFreeplayNodes() in tests. Consumers read these as live ES
// bindings, so they see the data the moment it lands.
export let FREEPLAY_NODES: FreeplayNode[] = []
export let FREEPLAY_READY = false

/** Install nodes directly (used by tests; the app uses loadFreeplayNodes). */
export function setFreeplayNodes(nodes: FreeplayNode[]): void {
  FREEPLAY_NODES = nodes
  FREEPLAY_READY = nodes.length > 0
}

let loadPromise: Promise<void> | null = null

/**
 * Fetch the solved node dataset from public/ once. Idempotent; failures leave
 * Freeplay dormant (the app falls back) rather than throwing.
 */
export function loadFreeplayNodes(): Promise<void> {
  if (loadPromise) return loadPromise
  const url = `${import.meta.env.BASE_URL}freeplay-nodes.json`
  loadPromise = fetch(url)
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => setFreeplayNodes(data as FreeplayNode[]))
    .catch(() => setFreeplayNodes([]))
  return loadPromise
}

/** The opener seat for a matchup id ('CO_vs_BB_SRP' → 'CO'). */
export const openerOf = (spot: string): RfiPosition => spot.split('_')[0] as RfiPosition

/** Hero's seat at the table: the opener when in position, the BB when out. */
export const heroSeatOf = (n: FreeplayNode) => (n.hero === 'IP' ? openerOf(n.spot) : 'BB')

/** Representative size (bb) the villain has bet when hero is facing a bet. */
export const facedBetBb = (street: 'flop' | 'turn') => (street === 'turn' ? 3 : 1.8)

/** A label's strategy at a node, with its argmax (the GTO "correct" action). */
export function freeplayStrategy(n: FreeplayNode, label: string): { freqs: number[]; primary: string } | null {
  const freqs = n.strategy[label]
  if (!freqs) return null
  let bi = 0
  for (let i = 1; i < freqs.length; i++) if (freqs[i] > freqs[bi]) bi = i
  return { freqs, primary: n.actions[bi] }
}

/** All 169 hand labels present in a node (for dealing a random hero hand). */
export const nodeLabels = (n: FreeplayNode): string[] => Object.keys(n.strategy)

/**
 * Pick a random node, balanced across kinds so the user keeps meeting variety
 * (raw counts are dominated by turn c-bets). Returns null when no data yet.
 */
export function randomFreeplayNode(): FreeplayNode | null {
  if (!FREEPLAY_READY) return null
  // 40% face-a-bet (the headline "react to a bet" spots), 30% c-bet, 20% donk, 10% other
  const want = Math.random()
  const pools: FreeplayNode[][] = [
    FREEPLAY_NODES.filter((n) => n.kind === 'face_cbet'),
    FREEPLAY_NODES.filter((n) => n.kind === 'cbet'),
    FREEPLAY_NODES.filter((n) => n.kind === 'donk'),
  ]
  const pick = want < 0.45 ? pools[0] : want < 0.78 ? pools[1] : pools[2]
  const pool = pick.length ? pick : FREEPLAY_NODES
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Pick a random FLOP node (kind-balanced) to START a continuous hand: every
 * Freeplay hand begins on the flop and can advance to the turn via
 * turnContinuation, so play feels like a hand rather than disjoint spots.
 */
export function randomFreeplayFlopNode(): FreeplayNode | null {
  if (!FREEPLAY_READY) return null
  const flop = FREEPLAY_NODES.filter((n) => n.street === 'flop')
  if (!flop.length) return null
  const want = Math.random()
  const pools = [
    flop.filter((n) => n.kind === 'face_cbet'),
    flop.filter((n) => n.kind === 'cbet'),
    flop.filter((n) => n.kind === 'donk'),
  ]
  const pick = want < 0.4 ? pools[0] : want < 0.72 ? pools[1] : pools[2]
  const pool = pick.length ? pick : flop
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * The turn node continuing a flop spot: same matchup, same flop, same hero
 * seat (IP keeps c-betting, OOP keeps facing a bet), a turn card that doesn't
 * clash with the hero's hand, and the hero's label covered. Null if none.
 */
export function turnContinuation(
  matchup: string,
  flopBoard: string,
  heroSeat: 'IP' | 'OOP',
  label: string,
  used: Set<string>,
): FreeplayNode | null {
  const wantKind = heroSeat === 'IP' ? 'cbet' : 'face_cbet'
  const cands = FREEPLAY_NODES.filter(
    (n) =>
      n.street === 'turn' &&
      n.spot === matchup &&
      n.hero === heroSeat &&
      n.kind === wantKind &&
      n.board.startsWith(flopBoard) &&
      !used.has(n.board.slice(6, 8)) && // turn card not already in the hero's hand
      n.strategy[label],
  )
  return cands.length ? cands[Math.floor(Math.random() * cands.length)] : null
}
