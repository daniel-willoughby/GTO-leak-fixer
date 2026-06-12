import type { Card } from '../lib/cards'

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
// muted, editorial 4-colour palette (slightly richer for legibility on cream)
const SUIT_COLOR: Record<string, string> = {
  s: 'text-[#23201b]',
  c: 'text-[#3f6b4d]',
  h: 'text-[#b23a29]',
  d: 'text-[#2f5aa0]',
}

// Note: card faces keep their fixed cream surface in dark mode, because the
// suit colours above are tuned for it (and white cards pop on the dark felt).
const SIZES = {
  sm: { box: 'w-9 h-[3.25rem] rounded-md', rank: 'text-base', suit: 'text-sm' },
  md: { box: 'w-16 h-[5.75rem] sm:w-[4.5rem] sm:h-[6.5rem] rounded-xl', rank: 'text-base', suit: 'text-5xl sm:text-[3.4rem]' },
} as const

export default function PlayingCard({ card, size = 'md' }: { card: Card; size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  const color = SUIT_COLOR[card.suit]
  const suit = SUIT_SYMBOL[card.suit]

  if (size === 'sm') {
    return (
      <div className={`${s.box} bg-[#fcfaf4] border border-[#e6e0d3] flex flex-col items-center justify-center leading-none shadow-[0_2px_8px_rgba(34,31,25,0.12)]`}>
        <span className={`${s.rank} font-semibold ${color}`}>{card.rank}</span>
        <span className={`${s.suit} ${color}`}>{suit}</span>
      </div>
    )
  }

  // large card: serif corner index + big centre pip
  const corner = (
    <span className={`flex flex-col items-center leading-none ${color}`}>
      <span className="serif text-lg font-semibold">{card.rank}</span>
      <span className="text-[10px] -mt-0.5">{suit}</span>
    </span>
  )
  return (
    <div className={`${s.box} bg-[#fcfaf4] border border-[#e6e0d3] relative shadow-[0_1px_0_rgba(34,31,25,0.04),0_10px_22px_-6px_rgba(34,31,25,0.18)]`}>
      <div className="absolute top-1.5 left-2">{corner}</div>
      <div className={`absolute inset-0 flex items-center justify-center ${s.suit} ${color} opacity-90`}>{suit}</div>
      <div className="absolute bottom-1.5 right-2 rotate-180">{corner}</div>
    </div>
  )
}
