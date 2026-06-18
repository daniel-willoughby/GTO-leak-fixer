import { describe, it, expect } from 'vitest'
import { boardTextureLabel, decisionLabel } from './db'

describe('postflop board-texture buckets', () => {
  it('buckets paired, monotone and connected flops', () => {
    expect(boardTextureLabel('AsAd9h')).toBe('Paired')
    expect(boardTextureLabel('Ah7h2h')).toBe('Monotone')
    expect(boardTextureLabel('9s8d7h')).toBe('Connected') // tight span, wettest
  })

  it('separates high-dry from low-dry rainbow flops', () => {
    expect(boardTextureLabel('Ah8s3d')).toBe('High & dry') // A-high rainbow, span 11
    expect(boardTextureLabel('8h5s2d')).toBe('Low & dry')
  })

  it('flags a two-tone (flush-draw) board', () => {
    expect(boardTextureLabel('Kh7h2d')).toBe('Two-tone')
  })
})

describe('postflop decision buckets', () => {
  it('maps every bet size to a single "should bet" bucket', () => {
    expect(decisionLabel('bet')).toBe('When you should bet')
    expect(decisionLabel('bet33')).toBe('When you should bet')
    expect(decisionLabel('bet75')).toBe('When you should bet')
  })

  it('labels check, fold, call and raise distinctly', () => {
    expect(decisionLabel('check')).toBe('When you should check')
    expect(decisionLabel('fold')).toBe('When you should fold')
    expect(decisionLabel('call')).toBe('When you should call')
    expect(decisionLabel('raise')).toBe('When you should raise')
  })
})
