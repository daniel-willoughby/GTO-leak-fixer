import { describe, it, expect } from 'vitest'
import { dropRapidDupes } from './db'
import type { DecisionRecord } from './db'

const mk = (ts: number, over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  ts,
  mode: 'rfi',
  context: 'UTG',
  position: 'UTG',
  label: 'AKs',
  category: 'Suited ace',
  chosen: 'raise',
  correct: 'raise',
  isCorrect: true,
  ...over,
})

describe('dropRapidDupes', () => {
  it('collapses a held/double-fired key into one decision', () => {
    // same spot+action a few ms apart = one answer logged twice
    const rows = [mk(1000), mk(1030), mk(1055)]
    expect(dropRapidDupes(rows)).toHaveLength(1)
  })

  it('keeps genuine replays of the same spot (seconds apart)', () => {
    const rows = [mk(1000), mk(3000), mk(9000)]
    expect(dropRapidDupes(rows)).toHaveLength(3)
  })

  it('does not collapse different spots logged close together', () => {
    const rows = [mk(1000), mk(1030, { label: 'KQs' }), mk(1050, { chosen: 'fold', correct: 'fold' })]
    expect(dropRapidDupes(rows)).toHaveLength(3)
  })

  it('is order-independent (sorts by ts first)', () => {
    const rows = [mk(1055), mk(1000), mk(1030)]
    const out = dropRapidDupes(rows)
    expect(out).toHaveLength(1)
    expect(out[0].ts).toBe(1000)
  })
})
