export type ChipTone = 'blind' | 'bet' | 'pot'

const TONE: Record<ChipTone, string> = {
  blind: 'radial-gradient(circle at 35% 28%, #bcd4ff 0%, #5b8def 45%, #2f5fd0 100%)',
  bet: 'radial-gradient(circle at 35% 28%, #ffc1c1 0%, #ef5b5b 45%, #c2281f 100%)',
  pot: 'radial-gradient(circle at 35% 28%, #ffe49b 0%, #f1b43a 45%, #c97f12 100%)',
}

const fmt = (n: number) => `${n} bb`

/** A small poker-chip stack with an amount label, for blinds / bets / the pot. */
export default function ChipStack({ amount, tone = 'bet' }: { amount: number; tone?: ChipTone }) {
  const bg = TONE[tone]
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-5 h-[26px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute left-0 w-5 h-5 rounded-full border-2 border-dashed border-white/75"
            style={{ background: bg, bottom: `${i * 3}px`, boxShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
          />
        ))}
      </div>
      <span className="text-[9px] leading-none font-bold text-white/95 px-1 py-px rounded bg-black/45 whitespace-nowrap">
        {fmt(amount)}
      </span>
    </div>
  )
}
