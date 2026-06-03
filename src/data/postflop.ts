// Postflop nodes — real TexasSolver output (see solver-spike/). Each node is a
// single decision (currently BTN c-betting a flop facing a check).

import { parseCards, type Card } from '../lib/cards'
import type { Position } from './ranges'
import flopBtnBb from './flop-btn-bb-Qs7h2c.json'

export interface FlopNode {
  spot: string
  board: string
  potType: string
  hero: Position
  facing: 'none' | 'check' | 'bet'
  betSizes: number[]
  actions: string[] // e.g. ['check','bet33']
  strategy: Record<string, number[]>
  meta: { solver: string; iterations: number; exploitability: string; generatedAt: string; approximate?: boolean }
}

export const FLOP_NODES: FlopNode[] = [flopBtnBb as unknown as FlopNode]

export interface FlopStrategy {
  /** index-aligned to node.actions */
  freqs: number[]
  /** highest-frequency action label, e.g. 'bet33' */
  primary: string
}

export function strategyFor(node: FlopNode, label: string): FlopStrategy | null {
  const freqs = node.strategy[label]
  if (!freqs) return null
  let bi = 0
  freqs.forEach((f, i) => (f > freqs[bi] ? (bi = i) : null))
  return { freqs, primary: node.actions[bi] }
}

export const boardCards = (node: FlopNode): Card[] => parseCards(node.board)

/** Labels the node has a strategy for (hands that reach this node). */
export const nodeLabels = (node: FlopNode): string[] => Object.keys(node.strategy)
