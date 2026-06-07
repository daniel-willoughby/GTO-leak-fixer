import { actionIndex, POSITION_ORDER, type Position, type RfiPosition } from '../data/ranges'
import type { Card } from '../lib/cards'
import PlayingCard from './PlayingCard'
import ChipStack, { type ChipTone } from './ChipStack'

export interface Chip {
  pos: Position
  amount: number
  tone: ChipTone
}

interface Props {
  heroPos: Position
  heroCards: [Card, Card]
  raiserPos?: RfiPosition
  /** Extra active (still-in) positions beyond hero for multiway spots */
  activePots?: Position[]
  /** Chips in front of each seat (blinds, opens, calls, 3-bets). */
  chips?: Chip[]
  /** Central pot to show (postflop). */
  pot?: number
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
        background: 'linear-gradient(155deg, #5b7461 0%, #4c6354 50%, #435448 100%)',
        boxShadow: '0 2px 5px rgba(34,31,25,0.4), 0 0 0 1px rgba(255,255,255,0.18) inset',
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
  hero: 'bg-paper2 text-ink border-paper2 shadow-[0_3px_10px_rgba(34,31,25,0.18)]',
  raiser: 'bg-heartred text-white border-[#9a3a26] shadow-[0_3px_10px_rgba(177,66,44,0.4)]',
  active: 'bg-paper2 text-ink border-paper2 shadow-[0_2px_8px_rgba(34,31,25,0.18)]',
  folded: 'bg-[#33423a] text-white/55 border-transparent line-through',
  waiting: 'bg-[#33423a] text-white border-[#283228] shadow-[0_2px_6px_rgba(34,31,25,0.25)]',
}

export default function PokerTable({ heroPos, heroCards, raiserPos, activePots = [], chips = [], pot, board, villain }: Props) {
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

  // Chips on the felt come from the caller (blinds, opens, calls, 3-bets per
  // mode); only render those whose seat is actually on the table.
  const bets = chips.filter((c) => seats.some((s) => s.pos === c.pos))
  const chipPos = (coord: { left: number; top: number }) => ({
    left: coord.left + (50 - coord.left) * 0.4,
    top: coord.top + (50 - coord.top) * 0.4,
  })

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[5/4]">
      {/* rail */}
      <div
        className="absolute inset-[10%] rounded-full p-[7px]"
        style={{
          background: 'linear-gradient(160deg, #6f5a45 0%, #5a4736 45%, #463727 100%)',
          boxShadow: '0 22px 45px -16px rgba(34,31,25,0.5), 0 1px 0 rgba(255,255,255,0.1) inset',
        }}
      >
        {/* felt */}
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 34%, #7e9a85 0%, #67836f 46%, #51695a 100%)',
            boxShadow: 'inset 0 3px 14px rgba(34,31,25,0.22), inset 0 0 60px rgba(34,31,25,0.16)',
          }}
        >
          {/* subtle inner ring */}
          <div className="absolute inset-[7%] rounded-full border border-white/[0.1]" />
          {board ? (
            <div className="flex gap-1.5 z-10">
              {board.map((c, i) => (
                <div key={i} className="animate-deal" style={{ animationDelay: `${i * 60}ms` }}>
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <span className="text-white/55 text-[10px] font-semibold tracking-[0.22em] serif italic">
              {raiserPos ? 'facing a raise' : "it's on you"}
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
          {status === 'raiser' && <span className="text-[10px] text-heartred font-semibold">raises</span>}
          {status === 'active' && villain && (
            <span className="text-[10px] text-white/80 font-semibold">{villain.note}</span>
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

      {/* central pot */}
      {pot != null && (
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[6] flex items-center gap-1.5" style={{ top: '28%' }}>
          <ChipStack amount={pot} tone="pot" />
          <span className="text-[9px] font-semibold tracking-widest text-white/55">POT</span>
        </div>
      )}

      {/* dealer button puck on the felt */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold z-10"
        style={{
          left: `${dealer.left}%`,
          top: `${dealer.top}%`,
          background: 'radial-gradient(circle at 35% 28%, #fcfaf4 0%, #efe9da 55%, #ddd2bb 100%)',
          color: '#435448',
          boxShadow: '0 2px 6px rgba(34,31,25,0.4), 0 0 0 1px rgba(255,255,255,0.6) inset',
        }}
        title="Dealer button"
      >
        D
      </div>
    </div>
  )
}
