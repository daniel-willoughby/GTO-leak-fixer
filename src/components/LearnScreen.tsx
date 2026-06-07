import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import RangeGrid from './RangeGrid'
import { isRfiHand, POSITION_LABEL, RFI_POSITIONS, RFI_RANGES, type RfiPosition } from '../data/ranges'

const LESSONS: { title: string; body: string }[] = [
  {
    title: 'What is "RFI"?',
    body: 'RFI = Raise First In. Everyone before you folded, so you are first to enter the pot. Your only good options are to raise or fold. Limping (just calling the big blind) is a leak. This trainer drills the single most important preflop decision in poker.',
  },
  {
    title: 'Why position changes everything',
    body: 'The later you act, the more information you have and the more often you play the pot in position. So you can open many more hands on the Button than Under the Gun. Same cards, different correct answer. That is the whole game.',
  },
  {
    title: 'Tight early, loose late',
    body: 'Under the Gun you open ~16% of hands. On the Button, ~47%. If you open the same range from every seat, you are either too loose up front (spewing) or too tight on the button (leaving money on the table).',
  },
  {
    title: 'Reading the range grid',
    body: 'Pairs run down the diagonal. Suited hands are the upper-right triangle, offsuit the lower-left. Green cells are hands you raise from that position. After each drill, check where your hand sat on the grid.',
  },
]

export default function LearnScreen() {
  const [pos, setPos] = useState<RfiPosition>('BTN')
  return (
    <div className="px-4 pb-28 pt-6 max-w-xl mx-auto flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        {LESSONS.map((l) => (
          <details key={l.title} className="panel p-4 group">
            <summary className="serif text-[17px] cursor-pointer list-none flex items-center justify-between">
              {l.title}
              <ChevronDown size={16} className="text-ink3 transition group-open:rotate-180" />
            </summary>
            <p className="text-sm text-ink2 mt-2 leading-relaxed">{l.body}</p>
          </details>
        ))}
      </section>

      <section className="panel p-4">
        <h2 className="serif text-lg mb-3">Explore opening ranges</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {RFI_POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                pos === p ? 'bg-sage text-white shadow-[0_4px_12px_-4px_rgba(67,84,72,0.6)]' : 'bg-ink/5 text-ink2 hover:bg-ink/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink2 mb-3 text-center">
          {POSITION_LABEL[pos]}, opens ~<span className="text-sage-dark font-semibold">{RFI_RANGES[pos].pct}%</span> of hands
        </p>
        <RangeGrid cell={(label) => (isRfiHand(pos, label) ? 'raise' : 'fold')} />
      </section>
    </div>
  )
}
