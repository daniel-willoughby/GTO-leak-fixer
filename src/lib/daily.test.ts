import { describe, it, expect, beforeEach } from 'vitest'
import {
  dayKey,
  prevDay,
  getDaily,
  isDailyDone,
  liveStreak,
  recordDailyCorrect,
  resetDaily,
  DAILY_GOAL,
} from './daily'

const at = (s: string) => new Date(`${s}T12:00:00`)
/** Reach today's goal; returns the final tick. */
const finishDay = (d: Date) => {
  let last = recordDailyCorrect(d)
  for (let i = 1; i < DAILY_GOAL; i++) last = recordDailyCorrect(d)
  return last
}

describe('date helpers', () => {
  it('formats and steps days, including month boundaries', () => {
    expect(dayKey(at('2026-06-09'))).toBe('2026-06-09')
    expect(prevDay('2026-06-01')).toBe('2026-05-31')
    expect(prevDay('2026-01-01')).toBe('2025-12-31')
  })
})

describe('daily challenge', () => {
  beforeEach(() => resetDaily())

  it('counts toward the goal and completes exactly at it', () => {
    const day = at('2026-06-09')
    for (let i = 0; i < DAILY_GOAL - 1; i++) {
      const t = recordDailyCorrect(day)
      expect(t.justCompleted).toBe(false)
      expect(isDailyDone(t.state)).toBe(false)
    }
    const done = recordDailyCorrect(day)
    expect(done.justCompleted).toBe(true)
    expect(done.state.streak).toBe(1)
    expect(isDailyDone(done.state)).toBe(true)
  })

  it('only completes once per day', () => {
    const day = at('2026-06-09')
    finishDay(day)
    const extra = recordDailyCorrect(day)
    expect(extra.justCompleted).toBe(false)
    expect(extra.state.streak).toBe(1)
  })

  it('extends the streak on consecutive days', () => {
    expect(finishDay(at('2026-06-09')).state.streak).toBe(1)
    expect(finishDay(at('2026-06-10')).state.streak).toBe(2)
    expect(finishDay(at('2026-06-11')).state.streak).toBe(3)
  })

  it('resets the streak after a missed day, tracking best', () => {
    finishDay(at('2026-06-09'))
    finishDay(at('2026-06-10')) // streak 2
    const after = finishDay(at('2026-06-12')) // skipped the 11th
    expect(after.state.streak).toBe(1)
    expect(after.state.best).toBe(2)
  })

  it('rolls the daily count over at midnight but keeps the streak alive', () => {
    finishDay(at('2026-06-09'))
    const next = getDaily(at('2026-06-10'))
    expect(next.count).toBe(0) // fresh day
    expect(liveStreak(next, at('2026-06-10'))).toBe(1) // yesterday still counts
  })

  it('reports a broken streak as 0 once two days lapse', () => {
    finishDay(at('2026-06-09'))
    const state = getDaily(at('2026-06-12'))
    expect(liveStreak(state, at('2026-06-12'))).toBe(0)
  })

  it('flags milestone streak lengths', () => {
    const days = ['2026-06-01', '2026-06-02', '2026-06-03']
    let last = finishDay(at(days[0]))
    last = finishDay(at(days[1]))
    last = finishDay(at(days[2]))
    expect(last.milestone).toBe(3) // 3-day milestone
  })
})
