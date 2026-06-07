export type ChipTone = 'blind' | 'bet' | 'pot'

// muted, editorial chip palette
const TONE: Record<ChipTone, { bg: string; ring: string }> = {
  blind: { bg: 'radial-gradient(circle at 38% 30%, #fbf6ea 0%, #ece1c8 55%, #d9cba8 100%)', ring: 'rgba(120,110,90,0.55)' },
  bet: { bg: 'radial-gradient(circle at 38% 30%, #d99e86 0%, #c2785f 55%, #a85942 100%)', ring: 'rgba(255,255,255,0.75)' },
  pot: { bg: 'radial-gradient(circle at 38% 30%, #8fa896 0%, #5b7461 55%, #44594c 100%)', ring: 'rgba(255,255,255,0.7)' },
}

const fmt = (n: number) => `${n} bb`

/** A small poker-chip stack with an amount label, for blinds / bets / the pot. */
export default function ChipStack({ amount, tone = 'bet' }: { amount: number; tone?: ChipTone }) {
  const { bg, ring } = TONE[tone]
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-5 h-[26px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute left-0 w-5 h-5 rounded-full border-2 border-dashed"
            style={{ background: bg, borderColor: ring, bottom: `${i * 3}px`, boxShadow: '0 1px 2px rgba(34,31,25,0.4)' }}
          />
        ))}
      </div>
      <span className="text-[9px] leading-none font-semibold text-white px-1.5 py-px rounded bg-[#3a352b]/70 whitespace-nowrap">
        {fmt(amount)}
      </span>
    </div>
  )
}
