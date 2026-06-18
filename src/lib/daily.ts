// Daily challenge + day-streak retention. The daily challenge is the 20-question
// ladder (see dailyLadder.ts); finishing it keeps your streak alive. Days roll on
// a shared UTC boundary so everyone plays the same ladder. Pure localStorage.

const KEY = 'lt-daily'
/** Streak lengths that earn a milestone celebration. */
export const MILESTONES = [3, 7, 14, 30, 60, 100]

export interface DailyState {
  /** UTC YYYY-MM-DD this state belongs to. */
  date: string
  /** Consecutive UTC days the ladder was completed. */
  streak: number
  best: number
  /** UTC YYYY-MM-DD the ladder was last completed. */
  lastDone: string
}

/** Shared UTC date string, e.g. "2026-06-18". */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** The UTC day before a given YYYY-MM-DD string. */
export function prevDay(key: string): string {
  const dt = new Date(`${key}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dayKey(dt)
}

function fresh(today: string): DailyState {
  return { date: today, streak: 0, best: 0, lastDone: '' }
}

function read(): DailyState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<DailyState> | null
    if (!raw || typeof raw.date !== 'string') return fresh(dayKey())
    return {
      date: raw.date,
      streak: raw.streak ?? 0,
      best: raw.best ?? 0,
      lastDone: raw.lastDone ?? '',
    }
  } catch {
    return fresh(dayKey())
  }
}

function write(s: DailyState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** Today's state, rolled to the current UTC day. */
export function getDaily(now: Date = new Date()): DailyState {
  const today = dayKey(now)
  const s = read()
  if (s.date !== today) {
    s.date = today
    write(s)
  }
  return s
}

/** Was the ladder already completed today? */
export function isDailyDone(s: DailyState): boolean {
  return s.lastDone === s.date
}

/**
 * The streak to display: alive only if the ladder was completed today or
 * yesterday, otherwise the run is broken and the effective streak is 0.
 */
export function liveStreak(s: DailyState, now: Date = new Date()): number {
  const today = dayKey(now)
  if (s.lastDone === today || s.lastDone === prevDay(today)) return s.streak
  return 0
}

export interface DailyTick {
  state: DailyState
  /** The ladder was completed on this very tick. */
  justCompleted: boolean
  /** Streak length if it crossed a milestone on this tick, else 0. */
  milestone: number
}

/** Record that today's ladder was completed; advances the streak (once a day). */
export function recordLadderComplete(now: Date = new Date()): DailyTick {
  const today = dayKey(now)
  const s = getDaily(now)
  if (isDailyDone(s)) return { state: s, justCompleted: false, milestone: 0 }
  // continue the run if yesterday counted, otherwise start a new one
  const base = s.lastDone === prevDay(today) ? s.streak : 0
  s.streak = base + 1
  s.best = Math.max(s.best, s.streak)
  s.lastDone = today
  write(s)
  return { state: s, justCompleted: true, milestone: MILESTONES.includes(s.streak) ? s.streak : 0 }
}

export function resetDaily(): void {
  localStorage.removeItem(KEY)
}
