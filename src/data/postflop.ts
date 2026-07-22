// Postflop nodes, real TexasSolver output, flop + turn streets.
// See solver-spike/transform-multistreet.mjs for how these are produced.

import { parseCards, suitAwareLabel, baseLabel, type Card } from '../lib/cards'
import type { Position } from './ranges'
import rawNodes from './street-nodes.json'

export type Street = 'flop' | 'turn' | 'river'

export interface StreetNode {
  spot: string
  /** Board cards so far. 6 chars = flop, 8 = turn, 10 = river. */
  board: string
  street: Street
  heroAction: string
  /** Human-readable action history up to this decision. */
  history: string[]
  potType: string
  hero: Position
  villain: Position
  facing: 'none' | 'check' | 'bet'
  betSizes: number[]
  actions: string[]
  strategy: Record<string, number[]>
  /** How mixed this node is (1 - mean top-action frequency across the range).
   *  0 = everyone plays one action, higher = a genuinely close decision. Only
   *  present on suit-aware corpora; used to rank Tricky-mode spots. */
  marginal?: number
  meta: { solver: string; generatedAt: string; approximate?: boolean }
}

// The bundled slim corpus is the always-available base; the native app grows
// this at runtime from fetched shards (see postflopLoader.ts). Everything is
// derived from `_raw` via rebuild(); the exported arrays are `let` so ES live
// bindings carry updates to importers without any re-import.
let _raw: StreetNode[] = rawNodes as unknown as StreetNode[]

const nodeKey = (n: StreetNode) => `${n.board}|${n.street}|${n.hero}|${n.facing}|${(n.history ?? []).join('/')}`
// The legacy spot generator only understands hero-BTN c-bet/barrel/bet nodes
// (facing 'check'). The rich shards also carry BB-defender and facing-donk/
// overbet nodes; those are quarantined in FACING_NODES until the facing drills
// consume them, so they never get dealt as an ordinary c-bet decision.
const isLegacyPlayable = (n: StreetNode) => n.hero === 'BTN' && (n.facing === 'check' || n.facing === 'none')

export let ALL_NODES: StreetNode[] = []
export let FLOP_NODES: StreetNode[] = []
export let TURN_NODES: StreetNode[] = []
export let RIVER_NODES: StreetNode[] = []
/** Rich BB / facing-donk / facing-overbet nodes, for the facing-line drills. */
export let FACING_NODES: StreetNode[] = []

function rebuild() {
  // dedup by full key; a shard node overrides the bundled one for the same spot
  const map = new Map<string, StreetNode>()
  for (const n of _raw) map.set(nodeKey(n), n)
  const nodes = [...map.values()]
  ALL_NODES = nodes.filter(isLegacyPlayable)
  FLOP_NODES = ALL_NODES.filter((n) => n.street === 'flop')
  TURN_NODES = ALL_NODES.filter((n) => n.street === 'turn')
  RIVER_NODES = ALL_NODES.filter((n) => n.street === 'river')
  FACING_NODES = nodes.filter((n) => !isLegacyPlayable(n))
}
rebuild()

// Bundled-only snapshots, frozen at load BEFORE any shard registers. The daily
// ladder draws its postflop rungs from these so every client builds an
// IDENTICAL set of daily questions: the shard-enriched native app and the
// bundled-only PWA agree, which is what keeps the shared leaderboard fair.
// registerNodes reassigns the FLOP/TURN pools but never touches these consts.
export const BUNDLED_FLOP_NODES: StreetNode[] = [...FLOP_NODES]
export const BUNDLED_TURN_NODES: StreetNode[] = [...TURN_NODES]

/** Append fetched shard nodes and rebuild the derived pools. */
export function registerNodes(nodes: StreetNode[]) {
  if (!nodes?.length) return
  _raw = _raw.concat(nodes)
  rebuild()
}

/** Distinct flop boards currently available to deal (grows as shards load). */
export const postflopBoardCount = () => new Set(FLOP_NODES.map((n) => n.board)).size

/** All turn nodes whose first 6 board chars match a given flop. */
export function turnNodesForFlop(flop: string): StreetNode[] {
  return TURN_NODES.filter((n) => n.board.startsWith(flop))
}

/** River nodes whose first 8 board chars match a given turn board. */
export function riverNodesForBoard(turnBoard: string): StreetNode[] {
  return RIVER_NODES.filter((n) => n.board.startsWith(turnBoard))
}

/** Whether any river continuation exists for this 8-char turn board. */
export const hasRiver = (turnBoard: string): boolean => RIVER_NODES.some((n) => n.board.startsWith(turnBoard))

export interface NodeStrategy {
  freqs: number[]
  primary: string
}

/**
 * Strategy for a hand at this node.
 *
 * Pass the actual dealt cards where they're known: on a flushy board the corpus
 * stores separate buckets for combos that make/draw the flush, and looking up
 * the bare 169 label there would hand back the rank-class average (the bug that
 * told a player to fold a made flush 75% of the time). Falls back to the plain
 * label for rainbow boards, and for nodes built before suit-aware aggregation,
 * so old and new corpora both work.
 */
export function strategyFor(node: StreetNode, label: string, hole?: [Card, Card]): NodeStrategy | null {
  const suitKey = hole ? suitAwareLabel(hole, parseCards(node.board)) : null
  const freqs = (suitKey ? node.strategy[suitKey] : undefined) ?? node.strategy[label]
  if (!freqs) return null
  let bi = 0
  freqs.forEach((f, i) => (f > freqs[bi] ? (bi = i) : null))
  return { freqs, primary: node.actions[bi] }
}

export const boardCards = (node: StreetNode): Card[] => parseCards(node.board)

/**
 * The 169-hand labels this node has strategy for. Suit-aware keys are collapsed
 * back to their base label and de-duplicated, so callers that pick a hand to
 * deal keep seeing plain labels ("87s"), never "87s|32".
 */
export const nodeLabels = (node: StreetNode): string[] => [...new Set(Object.keys(node.strategy).map(baseLabel))]

// Convenience: parse a 2-char card string like "Ah" → Card
export const parseCard = (s: string): Card => parseCards(s)[0]
