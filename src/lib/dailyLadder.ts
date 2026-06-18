// The daily 20-question ladder. Everyone in the world gets the *same* twenty
// spots on a given UTC day — fair for the leaderboard — because we seed
// Math.random from the date string while generating, so the existing spot
// generators run deterministically. Difficulty climbs: easy opens early,
// borderline preflop in the middle, tricky postflop at the end.

import { mulberry32, hashStr } from './rng'
import { generateSpot, seedOf, type SpotSeed, type DrillMode, type Difficulty } from './spot'

export const LADDER_LEN = 20

interface Rung {
  mode: DrillMode
  difficulty: Difficulty
}

// The difficulty curve across the 20 rungs.
const LADDER_PLAN: Rung[] = [
  // 1-5 — gentle: clear-cut opens
  ...Array.from({ length: 5 }, () => ({ mode: 'rfi' as DrillMode, difficulty: 'easy' as Difficulty })),
  // 6-8 — full-range opens
  ...Array.from({ length: 3 }, () => ({ mode: 'rfi' as DrillMode, difficulty: 'all' as Difficulty })),
  // 9-10 — facing a raise
  ...Array.from({ length: 2 }, () => ({ mode: 'vsRfi' as DrillMode, difficulty: 'all' as Difficulty })),
  // 11-13 — borderline defends
  ...Array.from({ length: 3 }, () => ({ mode: 'vsRfi' as DrillMode, difficulty: 'hard' as Difficulty })),
  // 14-15 — multiway squeezes
  ...Array.from({ length: 2 }, () => ({ mode: 'multiway' as DrillMode, difficulty: 'all' as Difficulty })),
  // 16-17 — postflop
  ...Array.from({ length: 2 }, () => ({ mode: 'postflop' as DrillMode, difficulty: 'all' as Difficulty })),
  // 18-20 — trickiest postflop spots
  ...Array.from({ length: 3 }, () => ({ mode: 'postflop' as DrillMode, difficulty: 'hard' as Difficulty })),
]

/** Run a function with Math.random seeded, then restore the real Math.random. */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random
  Math.random = mulberry32(seed)
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}

/** The 20 seeds for a given UTC day — identical on every client. */
export function dailyLadderSeeds(day: string): SpotSeed[] {
  return withSeededRandom(hashStr(`ladder-${day}`), () =>
    LADDER_PLAN.map((r) => seedOf(generateSpot(r.mode, { difficulty: r.difficulty }))),
  )
}

// ---- in-progress run state (resume after a refresh) ------------------------

export interface LadderProgress {
  day: string
  index: number // next question to answer (0..LADDER_LEN)
  score: number
  timeMs: number
}

const PROGRESS_KEY = 'lt-ladder-progress'

export function ladderProgress(day: string): LadderProgress | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null') as LadderProgress | null
    return p && p.day === day ? p : null
  } catch {
    return null
  }
}

export function saveLadderProgress(p: LadderProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
}

export function clearLadderProgress(): void {
  localStorage.removeItem(PROGRESS_KEY)
}
