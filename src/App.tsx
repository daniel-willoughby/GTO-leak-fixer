import { useEffect, useRef, useState } from 'react'
import { Spade, Target, GraduationCap, User, Volume2, VolumeX, SlidersHorizontal, Cloud, X, Coins, type LucideIcon } from 'lucide-react'
import DrillScreen, { type LadderRun } from './components/DrillScreen'
import DailyChallengeCard from './components/DailyChallengeCard'
import LadderResults from './components/LadderResults'
import LessonsScreen from './components/LessonsScreen'
import OnboardingScreen from './components/OnboardingScreen'
import LeaksScreen from './components/LeaksScreen'
import ProfileScreen from './components/ProfileScreen'
import AccountModal from './components/AccountModal'
import PwaUpdater from './components/PwaUpdater'
import { isMuted, setMuted } from './lib/sound'
import { getLevel, setLevel, type Level } from './lib/level'
import { supabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/useAuth'
import { syncNow, pushLocal } from './lib/sync'
import { newlyEarned, type Achievement } from './lib/achievements'
import { pointsState, recordDailyResult } from './lib/points'
import { dayKey, recordLadderComplete } from './lib/daily'
import { dailyLadderSeeds, ladderProgress, saveLadderProgress, clearLadderProgress } from './lib/dailyLadder'
import { submitDailyScore } from './lib/leaderboard'
import type { Difficulty, FocusRequest } from './lib/spot'

type Tab = 'drill' | 'lessons' | 'leaks' | 'profile'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'drill', label: 'Drill', icon: Spade },
  { id: 'lessons', label: 'Lessons', icon: GraduationCap },
  { id: 'leaks', label: 'Leaks', icon: Target },
  { id: 'profile', label: 'Profile', icon: User },
]

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Easy', note: 'Clear-cut decisions' },
  { id: 'all', label: 'All', note: 'Everything' },
  { id: 'hard', label: 'Hard', note: 'Borderline spots' },
]

type Theme = 'light' | 'dark' | 'auto'
const THEMES: Theme[] = ['light', 'auto', 'dark']

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  const [progress, setProgress] = useState(0)
  const [muted, setMutedState] = useState(isMuted())
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem('lt-difficulty') as Difficulty) || 'all',
  )
  const [level, setLevelState] = useState<Level | null>(() => getLevel())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('lt-theme') as Theme) || 'auto')
  // celebratory pop-up queue for freshly unlocked achievements
  const [toasts, setToasts] = useState<Achievement[]>([])
  // Poker Points balance, refreshed whenever progress changes
  const [pp, setPp] = useState<number | null>(null)
  useEffect(() => {
    pointsState().then((s) => setPp(s.balance))
  }, [progress])

  // daily ladder run + results
  const [ladderRun, setLadderRun] = useState<LadderRun | null>(null)
  const [ladderResult, setLadderResult] = useState<{ score: number; total: number } | null>(null)
  const [dailyVersion, setDailyVersion] = useState(0)

  function startLadder() {
    const day = dayKey()
    const seeds = dailyLadderSeeds(day)
    const saved = ladderProgress(day)
    setLadderResult(null)
    setLadderRun({
      seeds,
      startIndex: saved?.index ?? 0,
      startScore: saved?.score ?? 0,
      baseTimeMs: saved?.timeMs ?? 0,
      onProgress: (index, score, timeMs) => saveLadderProgress({ day, index, score, timeMs }),
      onComplete: (score, timeMs) => {
        recordDailyResult(day, score, timeMs)
        recordLadderComplete()
        clearLadderProgress()
        if (user) submitDailyScore(user.id, day, score, timeMs)
        setLadderRun(null)
        setLadderResult({ score, total: seeds.length })
        setProgress((p) => p + 1) // refresh PP
        setDailyVersion((v) => v + 1)
      },
      onExit: () => setLadderRun(null),
    })
  }

  // check for newly earned achievements after each decision/sync; first run on
  // mount seeds the baseline silently so returning players aren't flooded
  useEffect(() => {
    let alive = true
    newlyEarned().then((fresh) => {
      if (alive && fresh.length) setToasts((q) => [...q, ...fresh])
    })
    return () => {
      alive = false
    }
  }, [progress])

  // auto-dismiss the front toast after a beat
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts((q) => q.slice(1)), 4000)
    return () => clearTimeout(t)
  }, [toasts])

  // apply on change + follow the OS while in auto
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function pickTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('lt-theme', t)
  }
  // cloud sync (optional, only when Supabase is configured)
  const { user, loading: authLoading } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  // show a sign-in nudge once per session for unauthenticated visitors
  const NUDGE_KEY = 'lt-nudge-dismissed'
  const [nudge, setNudge] = useState(false)
  useEffect(() => {
    if (!supabaseConfigured || authLoading) return
    if (!user && !sessionStorage.getItem(NUDGE_KEY)) setNudge(true)
    if (user) setNudge(false)
  }, [user, authLoading])
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSyncNow() {
    if (!user) return
    setSyncing(true)
    try {
      await syncNow(user.id)
      setLastSynced(Date.now())
      setProgress((p) => p + 1) // refresh screens that read merged data
    } finally {
      setSyncing(false)
    }
  }

  // pull + merge on sign-in
  useEffect(() => {
    if (user) handleSyncNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // debounced background push after activity
  useEffect(() => {
    if (!user) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushLocal(user.id).then(() => setLastSynced(Date.now()))
    }, 4000)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, user?.id])

  function toggleMute() {
    const v = !muted
    setMuted(v)
    setMutedState(v)
  }

  function pickDifficulty(d: Difficulty) {
    setDifficulty(d)
    localStorage.setItem('lt-difficulty', d)
    setSettingsOpen(false)
  }

  function pickLevel(l: Level) {
    const firstTime = !level // onboarding pick vs a later change in settings
    setLevel(l)
    setLevelState(l)
    setSettingsOpen(false)
    // new beginners start on the guided Lessons path, not the free Drill tab
    if (firstTime && l === 'beginner') setTab('lessons')
  }

  if (!level) return <OnboardingScreen onPick={pickLevel} />

  function drillLeaks(req: FocusRequest) {
    // new object identity each time so the DrillScreen effect always re-fires
    setFocusRequest({ ...req })
    setTab('drill')
  }

  function openLesson(lessonId: string) {
    setOpenLessonId(lessonId)
    setTab('lessons')
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="safe-top sticky top-0 z-30 relative text-center py-3 border-b border-line bg-paper/80 backdrop-blur-md">
        <h1 className="serif text-xl font-semibold flex items-center justify-center gap-1">
          Leak<span className="text-sage">·</span>Tutor
        </h1>
        <button
          onClick={() => setTab('profile')}
          aria-label="Poker Points"
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-clay/30 bg-clay/10 px-2.5 py-1 text-sm font-bold tabular-nums text-clay transition hover:bg-clay/15"
        >
          <Coins size={15} />
          {pp ?? 0}
        </button>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {supabaseConfigured && (
            <button
              onClick={() => setAccountOpen(true)}
              aria-label="Account"
              className={`relative p-2 rounded-lg transition ${user ? 'text-sage' : 'text-ink2 hover:text-ink hover:bg-ink/5'}`}
            >
              <Cloud size={18} />
              {user && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sage" />}
            </button>
          )}
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Settings"
            className={`p-2 rounded-lg transition ${settingsOpen ? 'text-sage bg-ink/5' : 'text-ink2 hover:text-ink hover:bg-ink/5'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-ink/5 transition"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 w-60 rounded-2xl border border-line bg-paper2 shadow-xl p-3 text-left">
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Experience</p>
              <div className="flex gap-1 mb-3 p-1 rounded-xl bg-ink/[0.06] border border-line">
                {(['beginner', 'intermediate'] as Level[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => pickLevel(l)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                      level === l ? 'bg-sage text-white' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Theme</p>
              <div className="flex gap-1 mb-3 p-1 rounded-xl bg-ink/[0.06] border border-line">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => pickTheme(t)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                      theme === t ? 'bg-sage text-white dark:text-paper' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Difficulty</p>
              <div className="flex flex-col gap-1">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => pickDifficulty(d.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      difficulty === d.id ? 'bg-sage/15 text-sage-dark' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-xs text-ink3">{d.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* keyed so each tab change re-mounts and plays a gentle fade-up */}
        <div key={tab} className="animate-fade-up h-full">
          {tab === 'drill' &&
            (ladderRun ? (
              <DrillScreen level={level} onProgress={() => setProgress((p) => p + 1)} ladder={ladderRun} />
            ) : ladderResult ? (
              <LadderResults
                score={ladderResult.score}
                total={ladderResult.total}
                onClose={() => setLadderResult(null)}
                onLeaderboard={() => {
                  setLadderResult(null)
                  setTab('profile')
                }}
              />
            ) : (
              <div className="pt-4">
                <DailyChallengeCard day={dayKey()} version={dailyVersion} onPlay={startLadder} />
                <DrillScreen
                  level={level}
                  onProgress={() => setProgress((p) => p + 1)}
                  requestFocus={focusRequest}
                  onFocusConsumed={() => setFocusRequest(null)}
                  difficulty={difficulty}
                />
              </div>
            ))}
          {tab === 'lessons' && (
            <LessonsScreen
              onProgress={() => setProgress((p) => p + 1)}
              openLessonId={openLessonId}
              onOpened={() => setOpenLessonId(null)}
            />
          )}
          {tab === 'leaks' && <LeaksScreen version={progress} onDrillLeaks={drillLeaks} onOpenLesson={openLesson} />}
          {tab === 'profile' && (
            <ProfileScreen
              version={progress}
              configured={supabaseConfigured}
              userId={user?.id ?? null}
              onSignIn={() => setAccountOpen(true)}
              onChanged={() => setProgress((p) => p + 1)}
            />
          )}
        </div>
      </main>

      <nav className="safe-bottom fixed bottom-0 inset-x-0 z-30 bg-paper/90 backdrop-blur-xl border-t border-line flex sm:inset-x-auto sm:left-1/2 sm:bottom-5 sm:-translate-x-1/2 sm:w-[26rem] sm:rounded-2xl sm:border sm:px-1 sm:shadow-[0_12px_34px_-14px_rgba(34,31,25,0.4)]">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2.5 flex flex-col items-center gap-1 text-xs transition ${
                active ? 'text-ink font-semibold' : 'text-ink3 hover:text-ink2'
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sage" />}
              <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
              {t.label}
            </button>
          )
        })}
      </nav>

      {accountOpen && (
        <AccountModal
          onClose={() => setAccountOpen(false)}
          onSyncNow={handleSyncNow}
          syncing={syncing}
          lastSynced={lastSynced}
        />
      )}

      {toasts.length > 0 && (() => {
        const a = toasts[0]
        const Icon = a.icon
        return (
          <button
            key={a.id}
            onClick={() => {
              setTab('profile')
              setToasts((q) => q.slice(1))
            }}
            className="animate-toast safe-top fixed inset-x-0 top-3 z-[60] mx-auto flex w-[20rem] max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-sage/40 bg-paper2 p-3 text-left shadow-xl"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-white dark:text-paper">
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage">
                Achievement unlocked{a.reward > 0 && <span className="text-clay"> · +{a.reward} PP</span>}
              </p>
              <p className="truncate font-semibold text-ink">{a.title}</p>
            </div>
          </button>
        )
      })()}

      {nudge && (
        <div className="animate-toast safe-top fixed inset-x-0 top-3 z-[60] mx-auto flex w-[22rem] max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-line bg-paper2 p-3 shadow-xl">
          <Cloud size={20} className="shrink-0 text-sage" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Save your progress</p>
            <p className="text-xs text-ink2">Sign in to back up and sync across devices.</p>
          </div>
          <button
            onClick={() => {
              setNudge(false)
              setAccountOpen(true)
            }}
            className="shrink-0 rounded-lg bg-sage px-3 py-1.5 text-xs font-semibold text-white"
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setNudge(false)
              sessionStorage.setItem(NUDGE_KEY, '1')
            }}
            className="shrink-0 p-1 text-ink3 hover:text-ink"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <PwaUpdater />
    </div>
  )
}
