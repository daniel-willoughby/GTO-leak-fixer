import { useState } from 'react'
import { Search } from 'lucide-react'
import RangeGrid from './RangeGrid'
import { isRfiHand, rfiFreq, POSITION_LABEL, RFI_POSITIONS, RFI_RANGES, type RfiPosition } from '../data/ranges'
import { GLOSSARY } from '../data/glossary'

const GLOSSARY_ENTRIES = Object.entries(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0]))

export default function LearnScreen() {
  const [pos, setPos] = useState<RfiPosition>('BTN')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const terms = q
    ? GLOSSARY_ENTRIES.filter(([term, def]) => term.includes(q) || def.toLowerCase().includes(q))
    : GLOSSARY_ENTRIES
  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-3xl mx-auto flex flex-col gap-6">
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
        <RangeGrid
          cell={(label) => (isRfiHand(pos, label) ? 'raise' : 'fold')}
          freq={(label) => {
            const f = rfiFreq(pos, label)
            return f > 0 && f < 1 ? f : null
          }}
        />
      </section>

      <section className="panel p-4">
        <h2 className="serif text-lg mb-3">Glossary</h2>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms"
            className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink3 focus:border-sage/50 focus:outline-none"
          />
        </div>
        <dl className="flex flex-col divide-y divide-line">
          {terms.map(([term, def]) => (
            <div key={term} className="py-2.5">
              <dt className="serif text-[15px] capitalize text-ink">{term}</dt>
              <dd className="text-sm text-ink2 leading-relaxed mt-0.5">{def}</dd>
            </div>
          ))}
          {terms.length === 0 && <p className="py-3 text-sm text-ink3 text-center">No terms match “{query}”.</p>}
        </dl>
      </section>
    </div>
  )
}
