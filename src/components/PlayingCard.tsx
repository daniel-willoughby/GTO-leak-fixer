import type { Card } from '../lib/cards'

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLOR: Record<string, string> = {
  s: 'text-slate-900',
  c: 'text-green-700',
  h: 'text-red-600',
  d: 'text-blue-600',
}

const SIZES = {
  sm: { box: 'w-9 h-12 rounded-md', rank: 'text-lg', suit: 'text-base' },
  md: { box: 'w-16 h-24 sm:w-20 sm:h-28 rounded-lg', rank: 'text-3xl sm:text-4xl', suit: 'text-2xl sm:text-3xl' },
} as const

export default function PlayingCard({ card, size = 'md' }: { card: Card; size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  return (
    <div className={`${s.box} bg-white shadow-lg flex flex-col items-center justify-center`}>
      <span className={`${s.rank} font-bold leading-none ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
      <span className={`${s.suit} leading-none ${SUIT_COLOR[card.suit]}`}>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  )
}
