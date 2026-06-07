import { useState } from 'react'
import { Lock, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { CURRICULUM, lessonById, type Lesson } from '../data/curriculum'
import { isLessonUnlocked, lessonProgress, curriculumComplete } from '../lib/level'
import GlossaryText from './GlossaryText'
import DrillScreen from './DrillScreen'

interface Props {
  onProgress: () => void
}

type View = 'path' | 'intro' | 'drill'

export default function BeginnerPath({ onProgress }: Props) {
  const [view, setView] = useState<View>('path')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, setTick] = useState(0) // bump to re-read localStorage progress after a lesson
  const refresh = () => setTick((t) => t + 1)

  const active = activeId ? lessonById(activeId) : null

  function openLesson(l: Lesson) {
    setActiveId(l.id)
    setView('intro')
  }
  function backToPath() {
    refresh()
    setView('path')
  }

  if (view === 'drill' && active) {
    return <DrillScreen level="beginner" lesson={active} onProgress={onProgress} onExitLesson={backToPath} />
  }

  if (view === 'intro' && active) {
    return <LessonIntro lesson={active} onStart={() => setView('drill')} onBack={() => setView('path')} />
  }

  const done = CURRICULUM.filter((l) => lessonProgress(l.id).done).length
  return (
    <div className="px-4 pb-28 pt-5 max-w-xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="serif text-xl text-ink">Your learning path</h2>
        <p className="text-sm text-ink2 mt-1">
          {done} of {CURRICULUM.length} lessons complete
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className="h-full rounded-full bg-sage transition-all"
          style={{ width: `${(done / CURRICULUM.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {CURRICULUM.map((l) => {
          const prog = lessonProgress(l.id)
          const unlocked = isLessonUnlocked(l, CURRICULUM)
          const status = prog.done ? 'done' : unlocked ? 'open' : 'locked'
          const Icon = l.icon
          return (
            <button
              key={l.id}
              disabled={status === 'locked'}
              onClick={() => openLesson(l)}
              className={`panel flex items-center gap-3 p-4 text-left transition ${
                status === 'locked' ? 'opacity-55' : 'hover:border-sage/50 active:scale-[0.995]'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  status === 'done'
                    ? 'bg-sage text-white'
                    : status === 'open'
                      ? 'bg-sage/12 text-sage-dark'
                      : 'bg-ink/[0.06] text-ink3'
                }`}
              >
                {status === 'done' ? <Check size={20} /> : status === 'locked' ? <Lock size={16} /> : <Icon size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="serif text-[15px] leading-tight text-ink">{l.title}</p>
                <p className="truncate text-xs text-ink3">{l.blurb}</p>
                {status === 'open' && prog.correct > 0 && (
                  <p className="mt-0.5 text-xs text-sage-dark">
                    {prog.correct} / {l.goal} correct
                  </p>
                )}
              </div>
              {status !== 'locked' && <ArrowRight size={16} className="shrink-0 text-ink3" />}
            </button>
          )
        })}
      </div>

      {curriculumComplete(CURRICULUM) && (
        <div className="panel border-sage/30 bg-sage/[0.08] p-5 text-center">
          <Sparkles className="mx-auto mb-2 text-sage" size={22} />
          <p className="serif text-lg text-ink">You've graduated</p>
          <p className="mt-1 text-sm text-ink2">
            You've covered every core concept. Switch to Intermediate in settings for full free play across all modes.
          </p>
        </div>
      )}
    </div>
  )
}

function LessonIntro({ lesson, onStart, onBack }: { lesson: Lesson; onStart: () => void; onBack: () => void }) {
  const Icon = lesson.icon
  return (
    <div className="px-4 pb-28 pt-4 max-w-xl mx-auto flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1 self-start text-sm text-ink2 hover:text-ink">
        <ArrowLeft size={16} /> Back to path
      </button>
      <div className="panel flex flex-col gap-4 p-5 animate-pop">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage/12 text-sage-dark">
            <Icon size={22} />
          </span>
          <h2 className="serif text-xl leading-tight text-ink">{lesson.title}</h2>
        </div>
        <GlossaryText text={lesson.concept} className="text-[15px] leading-relaxed text-ink2" />
        {lesson.unlocksLabel && (
          <p className="flex items-center gap-1 text-xs font-medium text-sage-dark">
            <Sparkles size={13} /> {lesson.unlocksLabel}
          </p>
        )}
        <button onClick={onStart} className="btn btn-primary flex items-center justify-center gap-2 py-3.5 text-base">
          Start drilling <ArrowRight size={16} />
        </button>
        <p className="text-center text-xs text-ink3">Tap any underlined word for a quick definition.</p>
      </div>
    </div>
  )
}
