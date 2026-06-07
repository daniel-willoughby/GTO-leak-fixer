// Postflop nodes — real TexasSolver output, flop + turn streets.
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

export const ALL_NODES: StreetNode[] = rawNodes as unknown as StreetNode[]
export const FLOP_NODES = ALL_NODES.filter((n) => n.street === 'flop')
export const TURN_NODES = ALL_NODES.filter((n) => n.street === 'turn')
export const RIVER_NODES = ALL_NODES.filter((n) => n.street === 'river')

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
