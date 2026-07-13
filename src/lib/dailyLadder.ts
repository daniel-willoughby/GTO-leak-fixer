// The daily 20-question ladder. Everyone in the world gets the *same* twenty
// spots on a given UTC day, fair for the leaderboard, because we seed
// Math.random from the date string while generating, so the existing spot
// generators run deterministically. Difficulty climbs: easy opens early,
// borderline preflop in the middle, tricky postflop at the end.

import { mulberry32, hashStr } from './rng'
import { generateSpot, generateFreeplaySpot, seedOf, type Spot, type SpotSeed, type DrillMode, type Difficulty } from './spot'

export const LADDER_LEN = 20

interface Rung {
  mode: DrillMode
  difficulty: Difficulty
  /** Postflop rungs can be pinned to the turn for a continuation spot. */
  street?: 'flop' | 'turn'
  /** Out-of-position Freeplay rung: hero defends a c-bet as the BB. Falls back
   *  to a postflop spot if the Freeplay data hasn't loaded yet. */
  oop?: boolean
}

// The difficulty curve across the 20 rungs: gentle opens → borderline preflop →
// multiway → postflop as the aggressor → out-of-position defends late on.
const LADDER_PLAN: Rung[] = [
  // 1-5, gentle: clear-cut opens
  ...Array.from({ length: 5 }, () => ({ mode: 'rfi' as DrillMode, difficulty: 'easy' as Difficulty })),
  // 6-8, full-range opens
  ...Array.from({ length: 3 }, () => ({ mode: 'rfi' as DrillMode, difficulty: 'all' as Difficulty })),
  // 9-10, facing a raise
  ...Array.from({ length: 2 }, () => ({ mode: 'vsRfi' as DrillMode, difficulty: 'all' as Difficulty })),
  // 11-12, borderline defends
  ...Array.from({ length: 2 }, () => ({ mode: 'vsRfi' as DrillMode, difficulty: 'hard' as Difficulty })),
  // 13-14, multiway squeezes
  ...Array.from({ length: 2 }, () => ({ mode: 'multiway' as DrillMode, difficulty: 'all' as Difficulty })),
  // 15-16, postflop as the aggressor (flop c-bet)
  ...Array.from({ length: 2 }, () => ({ mode: 'postflop' as DrillMode, difficulty: 'all' as Difficulty })),
  // 17, out of position: defend a flop c-bet as the BB
  { mode: 'postflop' as DrillMode, difficulty: 'all' as Difficulty, oop: true },
  // 18-19, turn continuations
  ...Array.from({ length: 2 }, () => ({ mode: 'postflop' as DrillMode, difficulty: 'all' as Difficulty, street: 'turn' as const })),
  // 20, trickiest: out of position again
  { mode: 'postflop' as DrillMode, difficulty: 'hard' as Difficulty, oop: true },
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

/** The 20 seeds for a given UTC day, identical on every client. */
export function dailyLadderSeeds(day: string): SpotSeed[] {
  return withSeededRandom(hashStr(`ladder-${day}`), () =>
    LADDER_PLAN.map((r) => {
      // OOP rung: defend a c-bet as the BB (Freeplay data, on every platform).
      // Falls back to a normal postflop spot if Freeplay hasn't loaded yet.
      // Postflop rungs draw from the BUNDLED corpus only (bundledOnly), so the
      // 20 daily questions are identical on every client — the native app's
      // fetched shards never enter the shared daily, which would otherwise make
      // the leaderboard unfair. OOP rungs use bundled Freeplay data (also shard-
      // free), so they're already deterministic.
      const spot: Spot =
        (r.oop && generateFreeplaySpot('face_cbet')) ||
        generateSpot(r.mode, { difficulty: r.difficulty, street: r.street, bundledOnly: true })
      return seedOf(spot)
    }),
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
