import type { Card } from '../lib/cards'

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
// 4-colour deck — easier to read at a glance, preferred by serious players.
const SUIT_COLOR: Record<string, string> = {
  s: 'text-slate-800',
  c: 'text-green-600',
  h: 'text-red-600',
  d: 'text-blue-600',
}

const SIZES = {
  sm: { box: 'w-9 h-[3.25rem] rounded-md', rank: 'text-base', suit: 'text-sm' },
  md: { box: 'w-[4.5rem] h-[6.5rem] sm:w-20 sm:h-28 rounded-xl', rank: 'text-base', suit: 'text-5xl sm:text-6xl' },
} as const

export default function PlayingCard({ card, size = 'md' }: { card: Card; size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  const color = SUIT_COLOR[card.suit]
  const suit = SUIT_SYMBOL[card.suit]

  if (size === 'sm') {
    return (
      <div className={`${s.box} card-face flex flex-col items-center justify-center leading-none`}>
        <span className={`${s.rank} font-bold ${color}`}>{card.rank}</span>
        <span className={`${s.suit} ${color}`}>{suit}</span>
      </div>
    )
  }

  // large card: corner indices + big centre pip
  const corner = (
    <span className={`flex flex-col items-center leading-none ${color}`}>
      <span className="text-lg font-extrabold tracking-tight">{card.rank}</span>
      <span className="text-sm -mt-0.5">{suit}</span>
    </span>
  )
  return (
    <div className={`${s.box} card-face relative`}>
      <div className="absolute top-1.5 left-2">{corner}</div>
      <div className={`absolute inset-0 flex items-center justify-center ${s.suit} ${color} opacity-90`}>{suit}</div>
      <div className="absolute bottom-1.5 right-2 rotate-180">{corner}</div>
    </div>
  )
}
