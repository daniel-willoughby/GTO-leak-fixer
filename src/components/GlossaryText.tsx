import { useState } from 'react'
import { lookupTerm } from '../data/glossary'

// Renders a string containing [term] markers. Known terms become tappable,
// dotted-underline spans that pop a small definition card. Unknown markers and
// plain text pass through untouched. All elements are inline spans so this is
// safe to drop inside a <p>.

const TOKEN = /\[([^\]]+)\]/g

type Part = { t: 'text'; v: string } | { t: 'term'; v: string; def: string }

function parse(text: string): Part[] {
  const parts: Part[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) })
    const def = lookupTerm(m[1])
    parts.push(def ? { t: 'term', v: m[1], def } : { t: 'text', v: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) })
  return parts
}

export default function GlossaryText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const parts = parse(text)
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.t === 'text' ? (
          <span key={i}>{p.v}</span>
        ) : (
          <span key={i} className="relative inline-block">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="text-sage-dark font-medium underline decoration-dotted decoration-sage/60 underline-offset-2 hover:text-sage"
            >
              {p.v}
            </button>
            {open === i && (
              <>
                <span className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
                <span className="absolute left-0 bottom-full mb-1.5 z-50 block w-60 rounded-xl border border-line bg-paper2 p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink2 shadow-xl">
                  <span className="serif mb-1 block text-[13px] font-semibold capitalize text-ink">{p.v}</span>
                  {p.def}
                </span>
              </>
            )}
          </span>
        ),
      )}
    </span>
  )
}
