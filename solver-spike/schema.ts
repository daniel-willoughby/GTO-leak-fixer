// Postflop strategy data format — the contract between the solver pipeline
// and the app. The app never runs a solver; it queries pre-solved nodes
// shaped like this. Keep this stable: it is the moat-defining interface.

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'

export interface FlopNode {
  /** Stable id, e.g. "BTN_vs_BB_SRP". Identifies the preflop context. */
  spot: string
  /** Three board cards, rank+suit, e.g. "Qs7h2c". */
  board: string
  potType: 'srp' | '3bp'
  /** Whose decision this node encodes. */
  hero: Position
  /** What hero is facing at this node. */
  facing: 'none' | 'check' | 'bet'
  /** Bet sizes modelled, as fraction of pot. MVP uses a single size. */
  betSizes: number[]
  /** Action labels, index-aligned to every strategy frequency array. */
  actions: string[]
  /**
   * Strategy per holding. Key is a 169-hand label in this SPIKE; the
   * production corpus keys by exact combo (e.g. "QsQh") for blocker accuracy.
   * Value is a frequency vector aligned to `actions`, summing to ~1.
   */
  strategy: Record<string, number[]>
  meta: {
    solver: string
    iterations: number
    /** Reported solver exploitability, e.g. "0.18% pot". */
    exploitability: string
    generatedAt: string
    /** True while these are hand-tuned placeholders, not real solves. */
    approximate?: boolean
  }
}

/** Strategy for one holding at a node, plus the range-wide aggregate. */
export interface NodeQueryResult {
  hand: string
  found: boolean
  actions: string[]
  freqs: number[]
  /** Highest-frequency action — the "GTO answer" the drill scores against. */
  primary: string
}
