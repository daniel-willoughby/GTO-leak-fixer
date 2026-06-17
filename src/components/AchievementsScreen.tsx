import { useEffect, useState } from 'react'
import { Trophy, Check } from 'lucide-react'
import { getAchievements, type Achievement } from '../lib/achievements'

const GROUPS: Achievement['group'][] = ['Volume', 'Accuracy', 'Streaks', 'Learning']

function Row({ a }: { a: Achievement }) {
  const Icon = a.icon
  const pct = Math.round(a.progress * 100)
  return (
    <div className={`rounded-xl border p-3.5 ${a.done ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            a.done ? 'bg-sage text-white dark:text-paper' : 'bg-ink/[0.06] text-ink3'
          }`}
        >
          {a.done ? <Check size={18} /> : <Icon size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-semibold ${a.done ? 'text-sage-dark' : 'text-ink'}`}>{a.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-ink3">{a.label}</span>
          </div>
          <p className="text-[13px] text-ink2 leading-snug">{a.desc}</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={`h-full rounded-full transition-all ${a.done ? 'bg-sage' : 'bg-sage/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AchievementsScreen({ version }: { version: number }) {
  const [items, setItems] = useState<Achievement[] | null>(null)

  useEffect(() => {
    getAchievements().then(setItems)
  }, [version])

  if (!items) return null
  const done = items.filter((a) => a.done).length

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-5">
      <div className="panel flex items-center gap-3 p-4">
        <Trophy size={26} className="shrink-0 text-clay" />
        <div>
          <h1 className="serif text-xl">Achievements</h1>
          <p className="text-sm text-ink2">
            {done} of {items.length} unlocked. Keep drilling to fill the bars.
          </p>
        </div>
      </div>

      {GROUPS.map((g) => {
        const rows = items.filter((a) => a.group === g)
        if (!rows.length) return null
        return (
          <section key={g} className="flex flex-col gap-2.5">
            <h2 className="text-xs uppercase tracking-wide text-ink3 px-1">{g}</h2>
            {rows.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
