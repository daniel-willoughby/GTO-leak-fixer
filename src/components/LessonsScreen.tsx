import { useEffect, useState } from 'react'
import { Check, ArrowRight, ArrowLeft, Sparkles, GraduationCap, BookOpen, Trophy } from 'lucide-react'
import { CURRICULUM, lessonById, type Lesson } from '../data/curriculum'
import { lessonProgress, curriculumComplete } from '../lib/level'
import GlossaryText from './GlossaryText'
import DrillScreen from './DrillScreen'

interface Props {
  onProgress: () => void
  /** When set (e.g. from a leak's "Learn" button), jump straight into this lesson. */
  openLessonId?: string | null
  onOpened?: () => void
}

type View = 'list' | 'intro' | 'drill'

/** Section order, derived from the curriculum (first-seen). */
const GROUPS: string[] = [...new Set(CURRICULUM.map((l) => l.group))]
const INDEX = new Map(CURRICULUM.map((l, i) => [l.id, i + 1]))

/** Strip [term] markers and take the first sentence for a card teaser. */
function teaser(concept: string): string {
  const plain = concept.replace(/\[([^\]]+)\]/g, '$1')
  const end = plain.indexOf('. ')
  return end === -1 ? plain : plain.slice(0, end + 1)
}

export default function LessonsScreen({ onProgress, openLessonId, onOpened }: Props) {
  const [view, setView] = useState<View>('list')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, setTick] = useState(0) // bump to re-read localStorage progress after a lesson
  const refresh = () => setTick((t) => t + 1)

  // jump straight into a lesson requested from elsewhere (e.g. a leak's "Learn")
  useEffect(() => {
    if (openLessonId && lessonById(openLessonId)) {
      setActiveId(openLessonId)
      setView('intro')
      onOpened?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLessonId])

  const active = activeId ? lessonById(activeId) : null

  function openLesson(l: Lesson) {
    setActiveId(l.id)
    setView('intro')
  }
  function backToList() {
    refresh()
    setView('list')
  }

  if (view === 'drill' && active) {
    return <DrillScreen level="beginner" lesson={active} onProgress={onProgress} onExitLesson={backToList} />
  }
  if (view === 'intro' && active) {
    return <LessonIntro lesson={active} onStart={() => setView('drill')} onBack={() => setView('list')} />
  }

  const done = CURRICULUM.filter((l) => lessonProgress(l.id).done).length
  const pct = Math.round((done / CURRICULUM.length) * 100)

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-6">
      {/* header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage/12 text-sage-dark">
            <GraduationCap size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="serif text-2xl leading-tight text-ink">Lessons</h2>
            <p className="text-sm text-ink2">Learn the fundamentals — take them in any order.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
            <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink2">
            {done}/{CURRICULUM.length} done
          </span>
        </div>
      </header>

      {/* grouped sections */}
      {GROUPS.map((group) => {
        const lessons = CURRICULUM.filter((l) => l.group === group)
        const gd = lessons.filter((l) => lessonProgress(l.id).done).length
        return (
          <section key={group} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between px-0.5">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-sage-dark">{group}</h3>
              <span className="text-xs text-ink3 tabular-nums">
                {gd}/{lessons.length}
              </span>
            </div>
            {lessons.map((l) => {
              const prog = lessonProgress(l.id)
              const Icon = l.icon
              const started = prog.correct > 0 && !prog.done
              return (
                <button
                  key={l.id}
                  onClick={() => openLesson(l)}
                  className="panel group flex items-stretch gap-3 p-4 text-left transition hover:border-sage/50 hover:shadow-[0_12px_26px_-18px_rgba(67,84,72,0.45)] active:scale-[0.995]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      prog.done ? 'bg-sage text-white' : 'bg-sage/12 text-sage-dark'
                    }`}
                  >
                    {prog.done ? <Check size={22} /> : <Icon size={21} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tabular-nums text-ink3">
                        {String(INDEX.get(l.id)).padStart(2, '0')}
                      </span>
                      <p className="serif text-[15px] leading-tight text-ink">{l.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink2">{teaser(l.concept)}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      {prog.done ? (
                        <span className="flex items-center gap-1 font-semibold text-sage-dark">
                          <Check size={12} /> Complete
                        </span>
                      ) : started ? (
                        <span className="font-semibold text-sage-dark tabular-nums">
                          {prog.correct}/{l.goal} correct
                        </span>
                      ) : (
                        <span className="text-ink3">{l.goal} hands</span>
                      )}
                      <span className="text-ink3">·</span>
                      <span className="text-ink3">{l.blurb}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="mt-0.5 shrink-0 self-center text-ink3 transition group-hover:translate-x-0.5 group-hover:text-sage" />
                </button>
              )
            })}
          </section>
        )
      })}

      {curriculumComplete(CURRICULUM) ? (
        <div className="panel border-sage/30 bg-sage/[0.08] p-5 text-center">
          <Trophy className="mx-auto mb-2 text-clay" size={24} />
          <p className="serif text-lg text-ink">You've covered every lesson</p>
          <p className="mt-1 text-sm text-ink2">
            Now put it into practice in the Drill tab — and play full hands in Continuation.
          </p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink3">
          <BookOpen size={13} /> Each lesson teaches a concept, then drills it. Tap underlined words for definitions.
        </p>
      )}
    </div>
  )
}

function LessonIntro({ lesson, onStart, onBack }: { lesson: Lesson; onStart: () => void; onBack: () => void }) {
  const Icon = lesson.icon
  return (
    <div className="px-4 pb-28 pt-4 max-w-xl mx-auto flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1 self-start text-sm text-ink2 hover:text-ink">
        <ArrowLeft size={16} /> All lessons
      </button>
      <div className="panel flex flex-col gap-4 p-5 animate-pop">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage/12 text-sage-dark">
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sage-dark">{lesson.group}</p>
            <h2 className="serif text-xl leading-tight text-ink">{lesson.title}</h2>
          </div>
        </div>
        <GlossaryText text={lesson.concept} className="text-[15px] leading-relaxed text-ink2" />
        <button onClick={onStart} className="btn btn-primary flex items-center justify-center gap-2 py-3.5 text-base">
          Start drilling · {lesson.goal} hands <ArrowRight size={16} />
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink3">
          <Sparkles size={13} /> Tap any underlined word for a quick definition.
        </p>
      </div>
    </div>
  )
}
