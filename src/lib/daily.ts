// Daily challenge + day-streak retention mechanic. Pure localStorage, no Dexie.
// Each day you reach the goal (N correct decisions) keeps your streak alive;
// miss a day and it resets. Standard habit loop, fully offline.

const KEY = 'lt-daily'
export const DAILY_GOAL = 15
/** Streak lengths that earn a milestone celebration. */
export const MILESTONES = [3, 7, 14, 30, 60, 100]

export interface DailyState {
  /** YYYY-MM-DD that `count` belongs to. */
  date: string
  /** Correct decisions logged today. */
  count: number
  goal: number
  /** Consecutive days the goal was met (kept across the current/!broken run). */
  streak: number
  best: number
  /** YYYY-MM-DD the goal was last completed. */
  lastDone: string
}

/** Local-calendar date string, e.g. "2026-06-09". */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** The calendar day before a given YYYY-MM-DD string. */
export function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return dayKey(dt)
}

function fresh(today: string): DailyState {
  return { date: today, count: 0, goal: DAILY_GOAL, streak: 0, best: 0, lastDone: '' }
}

function read(): DailyState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<DailyState> | null
    if (!raw || typeof raw.date !== 'string') return fresh(dayKey())
    return {
      date: raw.date,
      count: raw.count ?? 0,
      goal: raw.goal ?? DAILY_GOAL,
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

/** Today's state, rolled over to the current day (count resets at midnight). */
export function getDaily(now: Date = new Date()): DailyState {
  const today = dayKey(now)
  const s = read()
  if (s.date !== today) {
    s.date = today
    s.count = 0
    write(s)
  }
  return s
}

/** Is the goal already met today? */
export function isDailyDone(s: DailyState): boolean {
  return s.lastDone === s.date
}

/**
 * The streak to display: alive only if the goal was met today or yesterday,
 * otherwise the run is broken and the effective streak is 0.
 */
export function liveStreak(s: DailyState, now: Date = new Date()): number {
  const today = dayKey(now)
  if (s.lastDone === today || s.lastDone === prevDay(today)) return s.streak
  return 0
}

export interface DailyTick {
  state: DailyState
  /** The goal was reached on this very tick. */
  justCompleted: boolean
  /** Streak length if it crossed a milestone on this tick, else 0. */
  milestone: number
}

/** Log one correct decision toward today's goal. */
export function recordDailyCorrect(now: Date = new Date()): DailyTick {
  const today = dayKey(now)
  const s = getDaily(now)
  const wasDone = isDailyDone(s)
  s.count += 1

  let justCompleted = false
  let milestone = 0
  if (!wasDone && s.count >= s.goal) {
    // continue the run if yesterday counted, otherwise start a new one
    const base = s.lastDone === prevDay(today) ? s.streak : 0
    s.streak = base + 1
    s.best = Math.max(s.best, s.streak)
    s.lastDone = today
    justCompleted = true
    if (MILESTONES.includes(s.streak)) milestone = s.streak
  }
  write(s)
  return { state: s, justCompleted, milestone }
}

export function resetDaily(): void {
  localStorage.removeItem(KEY)
}
