// Postflop nodes, real TexasSolver output, flop + turn streets.
// See solver-spike/transform-multistreet.mjs for how these are produced.

import { parseCards, type Card } from '../lib/cards'
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

export function strategyFor(node: StreetNode, label: string): NodeStrategy | null {
  const freqs = node.strategy[label]
  if (!freqs) return null
  let bi = 0
  freqs.forEach((f, i) => (f > freqs[bi] ? (bi = i) : null))
  return { freqs, primary: node.actions[bi] }
}

export const boardCards = (node: StreetNode): Card[] => parseCards(node.board)

export const nodeLabels = (node: StreetNode): string[] => Object.keys(node.strategy)

// Convenience: parse a 2-char card string like "Ah" → Card
export const parseCard = (s: string): Card => parseCards(s)[0]
