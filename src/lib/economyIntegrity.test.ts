import { describe, it, expect, beforeEach } from 'vitest'
import { signEconomyState, verifyEconomyState } from './points'

beforeEach(() => localStorage.clear())

describe('economy tamper detection', () => {
  it('accepts a legitimately-signed value', () => {
    localStorage.setItem('lt-daily-wins', JSON.stringify(['2026-06-01']))
    signEconomyState()
    expect(verifyEconomyState()).toBe(false)
    expect(localStorage.getItem('lt-daily-wins')).toBe(JSON.stringify(['2026-06-01']))
  })

  it('discards a hand-edited value (signature no longer matches)', () => {
    localStorage.setItem('lt-daily-wins', JSON.stringify(['2026-06-01']))
    signEconomyState()
    // simulate a devtools edit: 30 fake daily wins
    localStorage.setItem('lt-daily-wins', JSON.stringify(Array.from({ length: 30 }, (_, i) => `day-${i}`)))
    expect(verifyEconomyState()).toBe(true)
    expect(localStorage.getItem('lt-daily-wins')).toBeNull() // reverted to safe default
  })

  it('is fail-safe: legacy unsigned values are kept, not wiped', () => {
    // value present but never signed (existing player upgrading)
    localStorage.setItem('lt-bonus', JSON.stringify(['george-grant-5000']))
    expect(verifyEconomyState()).toBe(false)
    expect(localStorage.getItem('lt-bonus')).toBe(JSON.stringify(['george-grant-5000']))
  })
})
