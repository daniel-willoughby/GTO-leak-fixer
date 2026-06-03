import { actionIndex, POSITION_ORDER, type Position, type RfiPosition } from '../data/ranges'
import type { Card } from '../lib/cards'
import PlayingCard from './PlayingCard'

interface Props {
  heroPos: Position
  heroCards: [Card, Card]
  raiserPos?: RfiPosition
}

// Seat coordinates as % of the table container, seat 0 = hero (bottom), going clockwise.
const SEATS = [
  { left: 50, top: 84 },
  { left: 92, top: 66 },
  { left: 96, top: 28 },
  { left: 50, top: 8 },
  { left: 4, top: 28 },
  { left: 8, top: 66 },
]

type Status = 'hero' | 'raiser' | 'folded' | 'waiting'

export default function PokerTable({ heroPos, heroCards, raiserPos }: Props) {
  const heroIdx = actionIndex(heroPos)
  const seats = SEATS.map((coord, i) => {
    const pos = POSITION_ORDER[(heroIdx + i) % POSITION_ORDER.length]
    let status: Status = 'waiting'
    if (pos === heroPos) status = 'hero'
    else if (pos === raiserPos) status = 'raiser'
    else if (actionIndex(pos) < heroIdx) status = 'folded'
    return { pos, coord, status }
  })

  // Dealer button puck: sit it on the felt next to the BTN seat — pulled in
  // toward the centre, plus a tangential nudge so it never covers the cards.
  const btn = seats.find((s) => s.pos === 'BTN')!
  const dx = 50 - btn.coord.left
  const dy = 50 - btn.coord.top
  const len = Math.hypot(dx, dy) || 1
  const dealer = {
    left: btn.coord.left + dx * 0.24 + (-dy / len) * 11,
    top: btn.coord.top + dy * 0.24 + (dx / len) * 11,
  }

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[4/3]">
      {/* felt */}
      <div className="absolute inset-[14%] rounded-[50%] bg-emerald-800 border-[6px] border-amber-900/70 shadow-inner flex items-center justify-center">
        <span className="text-emerald-300/60 text-xs font-semibold tracking-widest">
          {raiserPos ? 'FACING A RAISE' : 'FOLDED TO YOU'}
        </span>
      </div>

      {seats.map(({ pos, coord, status }) => (
        <div
          key={pos}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          style={{ left: `${coord.left}%`, top: `${coord.top}%` }}
        >
          {status === 'hero' && (
            <div className="flex gap-1 mb-0.5">
              <PlayingCard card={heroCards[0]} size="sm" />
              <PlayingCard card={heroCards[1]} size="sm" />
            </div>
          )}
          <div
            className={[
              'px-2 py-1 rounded-lg text-xs font-bold border min-w-[42px] text-center',
              status === 'hero'
                ? 'bg-amber-500 text-slate-900 border-amber-300'
                : status === 'raiser'
                  ? 'bg-red-600 text-white border-red-300'
                  : status === 'folded'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 line-through'
                    : 'bg-slate-700 text-slate-200 border-slate-600',
            ].join(' ')}
          >
            {pos}
          </div>
          {status === 'raiser' && (
            <span className="text-[10px] text-red-300 font-semibold">raises</span>
          )}
        </div>
      ))}

      {/* dealer button puck on the felt */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-slate-900 text-[11px] font-bold flex items-center justify-center shadow-md ring-1 ring-slate-300"
        style={{ left: `${dealer.left}%`, top: `${dealer.top}%` }}
        title="Dealer button"
      >
        D
      </div>
    </div>
  )
}
