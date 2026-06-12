import { useState } from 'react'
import { lookupTerm } from '../data/glossary'

// Renders a string containing [term] markers. Known terms become tappable,
// dotted-underline spans that pop a small definition card. Unknown markers and
// plain text pass through untouched. All elements are inline spans so this is
// safe to drop inside a <p>.

const TOKEN = /\[([^\]]+)\]/g

type Part = { t: 'text'; v: string } | { t: 'term'; v: string; def: string }
type Pop = { i: number; left: number; top: number; w: number; above: boolean }

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
  const [pop, setPop] = useState<Pop | null>(null)
  const parts = parse(text)

  // Position the definition card with fixed, viewport-clamped coordinates so a
  // term near a screen edge never pushes the card off-screen (a 15rem card
  // can't reliably edge-anchor on a narrow phone).
  const place = (i: number, el: HTMLElement) => {
    if (pop?.i === i) return setPop(null)
    const r = el.getBoundingClientRect()
    const w = Math.min(240, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12))
    const above = r.top > 170 // flip below when the term sits near the top
    setPop({ i, left, top: above ? r.top : r.bottom, w, above })
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.t === 'text' ? (
          <span key={i}>{p.v}</span>
        ) : (
          <span key={i} className="inline-block">
            <button
              type="button"
              onClick={(e) => place(i, e.currentTarget)}
              className="text-sage-dark font-medium underline decoration-dotted decoration-sage/60 underline-offset-2 hover:text-sage"
            >
              {p.v}
            </button>
            {pop?.i === i && (
              <>
                <span className="fixed inset-0 z-40" onClick={() => setPop(null)} />
                <span
                  className="fixed z-50 block rounded-xl border border-line bg-paper2 p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink2 shadow-xl"
                  style={{
                    left: pop.left,
                    top: pop.top,
                    width: pop.w,
                    transform: pop.above ? 'translateY(calc(-100% - 6px))' : 'translateY(6px)',
                  }}
                >
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
