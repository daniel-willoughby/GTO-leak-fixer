import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Crown, Check } from 'lucide-react'
import { PRICE_MONTHLY, PRICE_YEARLY, purchasePro, restorePro, type ProPlan } from '../lib/pro'

const PERKS = [
  'Unlimited postflop and Freeplay hands',
  'Drill your leaks with adaptive focus',
  'Review-mistakes queue',
  'Every lesson unlocked',
]

/** Native-only Pro paywall. The daily challenge, duels, leaderboards, shop and
 *  preflop drilling stay free; this sells the improvement engine. */
export default function Paywall({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function buy(plan: ProPlan) {
    setBusy(true)
    setMsg(null)
    const res = await purchasePro(plan)
    if (!res.ok) setMsg(res.message ?? 'Purchase failed')
    else onClose()
    setBusy(false)
  }

  async function restore() {
    setBusy(true)
    setMsg(null)
    const res = await restorePro()
    if (!res.ok) setMsg(res.message ?? 'Nothing to restore')
    else onClose()
    setBusy(false)
  }

  // Portal to <body>: the tab wrapper animates with a transform, which would
  // otherwise become the containing block for this fixed overlay and push the
  // sheet off-screen.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-amber-400/40 bg-paper p-5 shadow-xl sm:rounded-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500">
            <Crown size={24} />
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-ink2 hover:bg-ink/5 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <h2 className="serif text-2xl text-ink">PotKing Pro</h2>
        <p className="mt-1 text-sm text-ink2">Everything you need to actually fix your leaks.</p>

        <ul className="mt-4 flex flex-col gap-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-ink">
              <Check size={15} className="shrink-0 text-sage" /> {p}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => buy('yearly')}
            disabled={busy}
            className="btn btn-primary relative py-3 text-sm disabled:opacity-60"
          >
            {PRICE_YEARLY} / year
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              SAVE 58%
            </span>
          </button>
          <button onClick={() => buy('monthly')} disabled={busy} className="btn btn-secondary py-3 text-sm disabled:opacity-60">
            {PRICE_MONTHLY} / month
          </button>
        </div>

        {msg && <p className="mt-3 text-center text-xs text-clay">{msg}</p>}

        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-ink3">
          <button onClick={restore} disabled={busy} className="underline hover:text-ink2">
            Restore purchase
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-ink3">
          The daily challenge, duels, leaderboards, shop and preflop drills stay free forever.
        </p>
      </div>
    </div>,
    document.body,
  )
}
