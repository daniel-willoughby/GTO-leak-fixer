import { describe, it, expect, beforeEach } from 'vitest'
import { duelOutcome, duelWinnerSide, settleFinishedDuels, incomingDuels, markDuelPlayed, type DuelRow } from './duel'
import { duelStats, duelNet, resetPoints } from './points'

beforeEach(() => {
  localStorage.clear()
  resetPoints()
})

const ME = 'me'
const THEM = 'them'

function duel(p: Partial<DuelRow>): DuelRow {
  return {
    id: 'd1',
    challenger: ME,
    challenger_handle: 'Me',
    challenger_avatar: 'avatar-chip',
    opponent: THEM,
    opponent_handle: 'Them',
    opponent_avatar: 'avatar-chip',
    wager: 100,
    seed: 'seed',
    status: 'done',
    challenger_score: 7,
    challenger_time: 1000,
    opponent_score: 4,
    opponent_time: 2000,
    created_at: new Date().toISOString(),
    ...p,
  }
}

describe('duel outcome', () => {
  it('higher score wins, lower loses (from each perspective)', () => {
    const d = duel({ challenger_score: 7, opponent_score: 4 })
    expect(duelOutcome(d, ME)).toBe('win')
    expect(duelOutcome(d, THEM)).toBe('loss')
    expect(duelWinnerSide(d)).toBe('challenger')
  })

  it('an equal score is broken by the faster total time', () => {
    const d = duel({ challenger_score: 5, opponent_score: 5, challenger_time: 1000, opponent_time: 9000 })
    expect(duelOutcome(d, ME)).toBe('win') // ME = challenger, faster
    expect(duelOutcome(d, THEM)).toBe('loss')
    expect(duelWinnerSide(d)).toBe('challenger')
  })

  it('an exact tie on both score and time is a push', () => {
    const d = duel({ challenger_score: 5, opponent_score: 5, challenger_time: 4000, opponent_time: 4000 })
    expect(duelOutcome(d, ME)).toBe('push')
    expect(duelOutcome(d, THEM)).toBe('push')
    expect(duelWinnerSide(d)).toBeNull()
  })
})

describe('settlement', () => {
  it('pays the wager out once per duel and records win/play stats', () => {
    const won = duel({ id: 'a', challenger_score: 9, opponent_score: 3, wager: 150 })
    const lost = duel({ id: 'b', challenger_score: 2, opponent_score: 8, wager: 50 })
    const tied = duel({ id: 'c', challenger_score: 5, opponent_score: 5, challenger_time: 7000, opponent_time: 7000, wager: 200 })

    expect(settleFinishedDuels(ME, [won, lost, tied])).toBe(3)
    expect(duelNet()).toBe(150 - 50) // push contributes 0
    const s = duelStats()
    expect(s).toMatchObject({ played: 3, won: 1, lost: 1 })

    // idempotent: re-settling the same duels pays nothing more
    expect(settleFinishedDuels(ME, [won, lost, tied])).toBe(0)
    expect(duelNet()).toBe(100)
  })

  it('only settles finished duels the user is part of', () => {
    const other = duel({ id: 'x', challenger: 'a', opponent: 'b', status: 'done' })
    const open = duel({ id: 'y', status: 'open', opponent: null })
    expect(settleFinishedDuels(ME, [other, open])).toBe(0)
  })
})

describe('inbox + played guard', () => {
  it('lists pending direct challenges to me, and hides ones I have played', () => {
    const a = duel({ id: 'p1', status: 'pending', opponent: ME })
    const b = duel({ id: 'p2', status: 'pending', opponent: ME })
    expect(incomingDuels([a, b], ME).map((d) => d.id)).toEqual(['p1', 'p2'])
    markDuelPlayed('p1')
    expect(incomingDuels([a, b], ME).map((d) => d.id)).toEqual(['p2'])
  })
})
