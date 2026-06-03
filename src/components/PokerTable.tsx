import { actionIndex, POSITION_ORDER, type Position, type RfiPosition } from '../data/ranges'
import type { Card } from '../lib/cards'
import PlayingCard from './PlayingCard'
import ChipStack, { type ChipTone } from './ChipStack'

const OPEN_SIZE = 2.5 // a standard 2.5bb open, shown as the raiser's bet
const SRP_POT = 5.5 // BTN open + BB call + dead SB

interface Props {
  heroPos: Position
  heroCards: [Card, Card]
  raiserPos?: RfiPosition
  /** Extra active (still-in) positions beyond hero for multiway spots */
  activePots?: Position[]
  // postflop
  board?: Card[]
  villain?: { pos: Position; note: string }
}

// Seat coordinates as % of the table container, seat 0 = hero (bottom). Seats
// trace CLOCKWISE to match POSITION_ORDER, so the player to hero's left (next
// clockwise position) sits on the left — e.g. the blinds sit left of the button.
const SEATS = [
  { left: 50, top: 89 }, // hero (bottom)
  { left: 10, top: 68 }, // lower-left
  { left: 9,  top: 28 }, // upper-left
  { left: 50, top: 7  }, // top
  { left: 91, top: 28 }, // upper-right
  { left: 90, top: 68 }, // lower-right
]

type Status = 'hero' | 'raiser' | 'active' | 'folded' | 'waiting'

function CardBack({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="w-6 h-[2.1rem] rounded-[5px] flex items-center justify-center"
      style={{
        background: 'linear-gradient(155deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
        animationDelay: `${delay}ms`,
      }}
    >
      <svg width="14" height="20" viewBox="0 0 14 20" className="opacity-30">
        <pattern id="cb" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="2" height="2" fill="white" transform="rotate(45 2 2)" />
        </pattern>
        <rect width="14" height="20" fill="url(#cb)" />
      </svg>
    </div>
  )
}

const SEAT_CLASS: Record<Status, string> = {
  hero: 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 border-amber-200/70 shadow-[0_0_18px_rgba(245,196,81,0.5)]',
  raiser: 'bg-gradient-to-b from-red-500 to-red-600 text-white border-red-300/50 shadow-[0_0_16px_rgba(239,68,68,0.45)]',
  active: 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-white/25 shadow-[0_0_14px_rgba(148,163,184,0.35)]',
  folded: 'bg-slate-800/70 text-slate-500 border-slate-700/50 line-through',
  waiting: 'bg-slate-700/70 text-slate-200 border-white/10 backdrop-blur-sm',
}

export default function PokerTable({ heroPos, heroCards, raiserPos, activePots = [], board, villain }: Props) {
  const heroIdx = actionIndex(heroPos)
  const postflop = !!board
  const seats = SEATS.map((coord, i) => {
    const pos = POSITION_ORDER[(heroIdx + i) % POSITION_ORDER.length]
    let status: Status = 'waiting'
    if (pos === heroPos) status = 'hero'
    else if (postflop) status = pos === villain?.pos ? 'active' : 'folded'
    else if (pos === raiserPos) status = 'raiser'
    else if (activePots.includes(pos)) status = 'active'
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
      ? { left: 68, top: 80 }
      : {
          left: btn.coord.left + dx * 0.24 + (-dy / len) * 11,
          top: btn.coord.top + dy * 0.24 + (dx / len) * 11,
        }

  // Chips on the felt: posted blinds + the raiser's bet preflop; a central pot
  // postflop (blinds + preflop action are already in the middle).
  const bets: { pos: Position; amount: number; tone: ChipTone }[] = []
  if (!postflop) {
    const amounts: Partial<Record<Position, { amount: number; tone: ChipTone }>> = {
      SB: { amount: 0.5, tone: 'blind' },
      BB: { amount: 1, tone: 'blind' },
    }
    if (raiserPos) amounts[raiserPos] = { amount: OPEN_SIZE, tone: 'bet' }
    for (const s of seats) {
      const a = amounts[s.pos]
      if (a) {
        // sit the chip ~40% of the way from the seat toward the centre
        bets.push({ pos: s.pos, amount: a.amount, tone: a.tone })
      }
    }
  }
  const chipPos = (coord: { left: number; top: number }) => ({
    left: coord.left + (50 - coord.left) * 0.4,
    top: coord.top + (50 - coord.top) * 0.4,
  })

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[5/4]">
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
          {(status === 'active' || status === 'raiser') && (
            <div className="flex gap-1 mb-0.5 animate-deal">
              <CardBack /><CardBack delay={70} />
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

      {/* chips: posted blinds + the raiser's bet, in front of each player */}
      {bets.map((b) => {
        const seat = seats.find((s) => s.pos === b.pos)!
        // the hero (bottom) shows big cards — park their own chip beside them
        const p = b.pos === heroPos ? { left: 29, top: 72 } : chipPos(seat.coord)
        return (
          <div
            key={`chip-${b.pos}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[6]"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <ChipStack amount={b.amount} tone={b.tone} />
          </div>
        )
      })}

      {/* central pot (postflop) */}
      {postflop && (
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[6] flex items-center gap-1.5" style={{ top: '28%' }}>
          <ChipStack amount={SRP_POT} tone="pot" />
          <span className="text-[9px] font-semibold tracking-widest text-emerald-200/50">POT</span>
        </div>
      )}

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
