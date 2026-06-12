import { GraduationCap, Gauge, ArrowRight, Check, type LucideIcon } from 'lucide-react'
import type { Level } from '../lib/level'

interface Props {
  onPick: (level: Level) => void
}

const CHOICES: { level: Level; icon: LucideIcon; tag: string; title: string; points: string[] }[] = [
  {
    level: 'beginner',
    icon: GraduationCap,
    tag: 'Beginner',
    title: 'New to poker theory',
    points: [
      'Plain-English explanations on every hand',
      'Hints whenever you want them',
      'A Lessons tab that teaches the fundamentals',
    ],
  },
  {
    level: 'intermediate',
    icon: Gauge,
    tag: 'Intermediate',
    title: 'I know the basics',
    points: [
      'Straight into free play, single spots or full hands',
      'Solver frequencies, mixed strategies, bet-sizing',
      'Drill leaks, review mistakes, track progress',
    ],
  },
]

export default function OnboardingScreen({ onPick }: Props) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-5 py-10 max-w-xl mx-auto">
      <div className="text-center mb-8 animate-pop">
        <h1 className="serif text-3xl font-semibold flex items-center justify-center gap-1">
          Leak<span className="text-sage">·</span>Tutor
        </h1>
        <p className="text-ink2 mt-2 text-[15px] leading-relaxed">
          Learn GTO poker by drilling real solver decisions. First, how much do you already know?
        </p>
      </div>

      <div className="w-full flex flex-col gap-4">
        {CHOICES.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.level}
              onClick={() => onPick(c.level)}
              className="panel p-5 text-left group transition hover:border-sage/50 hover:shadow-[0_14px_30px_-18px_rgba(67,84,72,0.4)] active:scale-[0.995]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage/12 text-sage-dark">
                  <Icon size={22} />
                </span>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-ink3">{c.tag}</p>
                  <p className="serif text-lg text-ink leading-tight">{c.title}</p>
                </div>
                <ArrowRight size={18} className="text-ink3 transition group-hover:translate-x-0.5 group-hover:text-sage" />
              </div>
              <ul className="flex flex-col gap-1.5">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-ink2">
                    <Check size={15} className="mt-0.5 shrink-0 text-sage" />
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-ink3 mt-6 text-center">You can switch anytime in settings.</p>
    </div>
  )
}
