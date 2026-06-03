import { actionIndex, POSITION_ORDER, type Position, type RfiPosition } from '../data/ranges'
import type { Card } from '../lib/cards'
import PlayingCard from './PlayingCard'

interface Props {
  heroPos: Position
  heroCards: [Card, Card]
  raiserPos?: RfiPosition
  // postflop
  board?: Card[]
  villain?: { pos: Position; note: string }
}

// Seat coordinates as % of the table container, seat 0 = hero (bottom). Seats
// trace CLOCKWISE to match POSITION_ORDER, so the player to hero's left (next
// clockwise position) sits on the left — e.g. the blinds sit left of the button.
const SEATS = [
  { left: 50, top: 84 }, // hero (bottom)
  { left: 8, top: 66 }, //  lower-left
  { left: 4, top: 28 }, //  upper-left
  { left: 50, top: 8 }, //  top
  { left: 96, top: 28 }, // upper-right
  { left: 92, top: 66 }, // lower-right
]

type Status = 'hero' | 'raiser' | 'active' | 'folded' | 'waiting'

const SEAT_CLASS: Record<Status, string> = {
  hero: 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 border-amber-200/70 shadow-[0_0_18px_rgba(245,196,81,0.5)]',
  raiser: 'bg-gradient-to-b from-red-500 to-red-600 text-white border-red-300/50 shadow-[0_0_16px_rgba(239,68,68,0.45)]',
  active: 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-white/25 shadow-[0_0_14px_rgba(148,163,184,0.35)]',
  folded: 'bg-slate-800/70 text-slate-500 border-slate-700/50 line-through',
  waiting: 'bg-slate-700/70 text-slate-200 border-white/10 backdrop-blur-sm',
}

export default function PokerTable({ heroPos, heroCards, raiserPos, board, villain }: Props) {
  const heroIdx = actionIndex(heroPos)
  const postflop = !!board
  const seats = SEATS.map((coord, i) => {
    const pos = POSITION_ORDER[(heroIdx + i) % POSITION_ORDER.length]
    let status: Status = 'waiting'
    if (pos === heroPos) status = 'hero'
    else if (postflop) status = pos === villain?.pos ? 'active' : 'folded'
    else if (pos === raiserPos) status = 'raiser'
    else if (actionIndex(pos) < heroIdx) status = 'folded'
    return { pos, coord, status }
  })

  // Dealer button puck on the felt next to the BTN seat. When the hero is on
  // the button, the bottom seat shows large hole cards, so park the puck to
  // their lower-right instead of the generic offset (which would cover them).
  const btn = seats.find((s) => s.pos === 'BTN')!
  const dx = 50 - btn.coord.left
  const dy = 50 - btn.coord.top
  const len = Math.hypot(dx, dy) || 1
  const dealer =
    heroPos === 'BTN'
      ? { left: 71, top: 78 }
      : {
          left: btn.coord.left + dx * 0.24 + (-dy / len) * 11,
          top: btn.coord.top + dy * 0.24 + (dx / len) * 11,
        }

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[4/3]">
      {/* rail */}
      <div
        className="absolute inset-[10%] rounded-full p-[9px]"
        style={{
          background: 'linear-gradient(160deg, #e7c98c 0%, #bd9250 32%, #7c5a2c 66%, #4c3719 100%)',
          boxShadow: '0 22px 45px -14px rgba(0,0,0,0.75), 0 1px 0 rgba(255,255,255,0.12) inset',
        }}
      >
        {/* felt */}
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 36%, #1f825e 0%, #136349 46%, #0b3d2c 100%)',
            boxShadow: 'inset 0 3px 14px rgba(0,0,0,0.5), inset 0 0 70px rgba(0,0,0,0.4)',
          }}
        >
          {/* subtle inner ring */}
          <div className="absolute inset-[7%] rounded-full border border-white/[0.06]" />
          {board ? (
            <div className="flex gap-1.5 z-10">
              {board.map((c, i) => (
                <div key={i} className="animate-deal" style={{ animationDelay: `${i * 60}ms` }}>
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <span className="text-emerald-200/35 text-[10px] font-semibold tracking-[0.25em]">
              {raiserPos ? 'FACING A RAISE' : 'FOLDED TO YOU'}
            </span>
          )}
        </div>
      </div>

      {seats.map(({ pos, coord, status }) => (
        <div
          key={pos}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10"
          style={{ left: `${coord.left}%`, top: `${coord.top}%` }}
        >
          {status === 'hero' && (
            <div className="flex gap-1 mb-0.5">
              <div className="animate-deal">
                <PlayingCard card={heroCards[0]} size="sm" />
              </div>
              <div className="animate-deal" style={{ animationDelay: '70ms' }}>
                <PlayingCard card={heroCards[1]} size="sm" />
              </div>
            </div>
          )}
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border min-w-[42px] text-center ${SEAT_CLASS[status]}`}
          >
            {pos}
          </div>
          {status === 'raiser' && <span className="text-[10px] text-red-300 font-semibold">raises</span>}
          {status === 'active' && villain && (
            <span className="text-[10px] text-slate-300 font-semibold">{villain.note}</span>
          )}
        </div>
      ))}

      {/* dealer button puck on the felt */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold z-10"
        style={{
          left: `${dealer.left}%`,
          top: `${dealer.top}%`,
          background: 'radial-gradient(circle at 35% 28%, #ffffff 0%, #e8eaef 55%, #c4cad6 100%)',
          color: '#b07c1e',
          boxShadow: '0 2px 6px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.55) inset',
        }}
        title="Dealer button"
      >
        D
      </div>
    </div>
  )
}
