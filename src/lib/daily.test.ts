import { describe, it, expect, beforeEach } from 'vitest'
import { dayKey, prevDay, getDaily, isDailyDone, liveStreak, recordLadderComplete, resetDaily } from './daily'

// noon UTC so the date is unambiguous regardless of the runner's timezone
const at = (s: string) => new Date(`${s}T12:00:00Z`)
const finishDay = (d: Date) => recordLadderComplete(d)

describe('date helpers', () => {
  it('formats and steps UTC days, including month boundaries', () => {
    expect(dayKey(at('2026-06-09'))).toBe('2026-06-09')
    expect(prevDay('2026-06-01')).toBe('2026-05-31')
    expect(prevDay('2026-01-01')).toBe('2025-12-31')
  })
})

describe('daily ladder streak', () => {
  beforeEach(() => resetDaily())

  it('completing the ladder marks the day done and starts a streak', () => {
    const done = recordLadderComplete(at('2026-06-09'))
    expect(done.justCompleted).toBe(true)
    expect(done.state.streak).toBe(1)
    expect(isDailyDone(done.state)).toBe(true)
  })

  it('only completes once per day', () => {
    finishDay(at('2026-06-09'))
    const extra = recordLadderComplete(at('2026-06-09'))
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

  it('keeps the streak alive across midnight (yesterday still counts)', () => {
    finishDay(at('2026-06-09'))
    const next = getDaily(at('2026-06-10'))
    expect(isDailyDone(next)).toBe(false) // not done yet today
    expect(liveStreak(next, at('2026-06-10'))).toBe(1)
  })

  it('reports a broken streak as 0 once two days lapse', () => {
    finishDay(at('2026-06-09'))
    const state = getDaily(at('2026-06-12'))
    expect(liveStreak(state, at('2026-06-12'))).toBe(0)
  })

  it('flags milestone streak lengths', () => {
    finishDay(at('2026-06-01'))
    finishDay(at('2026-06-02'))
    const last = finishDay(at('2026-06-03'))
    expect(last.milestone).toBe(3)
  })
})
