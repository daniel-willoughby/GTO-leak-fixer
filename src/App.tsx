import { useEffect, useRef, useState } from 'react'
import { Spade, Target, GraduationCap, User, CalendarCheck, Swords, Volume2, VolumeX, SlidersHorizontal, Cloud, X, Coins, type LucideIcon } from 'lucide-react'
import DrillScreen, { type LadderRun } from './components/DrillScreen'
import { Wordmark } from './components/Wordmark'
import DailyChallengeCard from './components/DailyChallengeCard'
import DailyLeaderboard from './components/DailyLeaderboard'
import LadderResults from './components/LadderResults'
import LessonsScreen from './components/LessonsScreen'
import OnboardingScreen from './components/OnboardingScreen'
import LeaksScreen from './components/LeaksScreen'
import ProfileScreen from './components/ProfileScreen'
import DuelsScreen from './components/DuelsScreen'
import { Avatar } from './components/Avatar'
import AccountModal from './components/AccountModal'
import PwaUpdater from './components/PwaUpdater'
import { isMuted, setMuted } from './lib/sound'
import { hapticsEnabled, setHaptics, haptic } from './lib/haptics'
import { getLevel, setLevel, type Level } from './lib/level'
import { supabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/useAuth'
import { syncNow, pushLocal } from './lib/sync'
import { compactDecisions } from './lib/db'
import { newlyEarned, markAchievementsSeen, type Achievement } from './lib/achievements'
import { pointsState, recordDailyResult, dailyResult, claimNamedBonus, verifyEconomyState, equipped } from './lib/points'
import { dayKey, recordLadderComplete } from './lib/daily'
import { dailyLadderSeeds, ladderProgress, saveLadderProgress, clearLadderProgress } from './lib/dailyLadder'
import { submitDailyScore, fetchIncomingRequests, getHandle } from './lib/leaderboard'
import {
  createDuel,
  createOpenDuel,
  answerDuel,
  acceptOpenDuel,
  declineDuel,
  duelSeeds,
  newDuelSeed,
  fetchDuels,
  incomingDuels,
  settleFinishedDuels,
  duelOutcome,
  unseenConclusions,
  markConclusionsSeen,
  markDuelPlayed,
  type DuelRow,
} from './lib/duel'
import { DEFAULT_AVATAR } from './lib/shop'
import type { Difficulty, FocusRequest } from './lib/spot'

type Tab = 'drill' | 'daily' | 'duels' | 'lessons' | 'leaks' | 'profile'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'drill', label: 'Drill', icon: Spade },
  { id: 'daily', label: 'Daily', icon: CalendarCheck },
  { id: 'duels', label: 'Duels', icon: Swords },
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
  const [haptics, setHapticsState] = useState(hapticsEnabled())
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
  // Tamper check: drop any hand-edited economy value *before* PP is derived.
  // A lazy initializer runs once, during the first render, ahead of all effects.
  useState(() => verifyEconomyState())
  // Poker Points balance, refreshed whenever progress changes
  const [pp, setPp] = useState<number | null>(null)
  useEffect(() => {
    pointsState().then((s) => setPp(s.balance))
  }, [progress])

  // claim any one-off PP gift this handle qualifies for (e.g. George's bonus)
  useEffect(() => {
    if (claimNamedBonus(getHandle())) setProgress((p) => p + 1)
  }, [])

  // one-time heal: remove any rapid-fire duplicate decisions a double-firing
  // key logged in the past, which had been inflating the decision count + PP
  useEffect(() => {
    compactDecisions().then((removed) => removed && setProgress((p) => p + 1))
  }, [])

  // daily ladder run + results
  const [ladderRun, setLadderRun] = useState<LadderRun | null>(null)
  const [ladderResult, setLadderResult] = useState<{ score: number; total: number } | null>(null)
  const [dailyVersion, setDailyVersion] = useState(0)

  // one-per-day invite popup nudging the player toward today's challenge
  const DAILY_INVITE_KEY = 'lt-daily-invite-dismissed'
  const [dailyInvite, setDailyInvite] = useState(false)
  useEffect(() => {
    const today = dayKey()
    const done = dailyResult(today)?.completed
    const dismissed = localStorage.getItem(DAILY_INVITE_KEY) === today
    setDailyInvite(!done && !dismissed)
  }, [dailyVersion])
  function dismissDailyInvite() {
    localStorage.setItem(DAILY_INVITE_KEY, dayKey())
    setDailyInvite(false)
  }

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
      // a sync pulls in a whole history at once; fold those already-earned
      // achievements into the "seen" set so they don't re-pop ("+PP" each login)
      await markAchievementsSeen()
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

  // incoming friend-request count → notification dot on the Profile tab. Polled
  // on sign-in, after profile actions (progress), and on a slow interval.
  const [friendReqCount, setFriendReqCount] = useState(0)
  useEffect(() => {
    if (!user) return setFriendReqCount(0)
    const refresh = () => fetchIncomingRequests(user.id).then((r) => setFriendReqCount(r.length))
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, progress])

  // ---- duels ----
  const [duelsVersion, setDuelsVersion] = useState(0)
  const [duelReqCount, setDuelReqCount] = useState(0)
  // brief "VS" splash shown before a duel's 10 questions begin
  const [duelIntro, setDuelIntro] = useState<{ me: string; them: string; handle: string } | null>(null)
  // toast notices when one of your duels concludes (you may not be on the tab)
  const [duelNotices, setDuelNotices] = useState<{ id: string; title: string; sub: string; tone: 'win' | 'loss' | 'push' }[]>([])
  // guard against launching the same duel's run twice (rapid taps / refetch race)
  const duelGuard = useRef<Set<string>>(new Set())

  // Poll the duels this user is in: settle finished wagers, surface a result
  // notice for any newly-concluded duel, and keep the inbox badge in sync. Runs
  // on the Duels tab and on a slow interval so you're notified anywhere.
  useEffect(() => {
    if (!user) {
      setDuelReqCount(0)
      return
    }
    const uid = user.id
    const refresh = () =>
      fetchDuels(uid).then((d) => {
        setDuelReqCount(incomingDuels(d, uid).length)
        const settled = settleFinishedDuels(uid, d)
        const fresh = unseenConclusions(uid, d)
        if (fresh.length) {
          markConclusionsSeen(fresh.map((x) => x.id))
          setDuelNotices((q) => [
            ...q,
            ...fresh.map((x) => {
              const out = duelOutcome(x, uid)
              const them = x.challenger === uid ? x.opponent_handle : x.challenger_handle
              const name = them || 'your opponent'
              return {
                id: x.id,
                tone: out,
                title: out === 'win' ? 'Duel won!' : out === 'loss' ? 'Duel lost' : 'Duel drawn',
                sub:
                  out === 'win'
                    ? `You beat ${name}${x.wager > 0 ? ` · +${x.wager} PP` : ''}`
                    : out === 'loss'
                      ? `${name} won${x.wager > 0 ? ` · −${x.wager} PP` : ''}`
                      : `Tied with ${name}, no PP changes hands`,
              }
            }),
          ])
        }
        if (settled || fresh.length) setProgress((p) => p + 1) // refresh PP
      })
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, duelsVersion])

  // auto-dismiss the front duel notice after a beat
  useEffect(() => {
    if (!duelNotices.length) return
    const t = setTimeout(() => setDuelNotices((q) => q.slice(1)), 4500)
    return () => clearTimeout(t)
  }, [duelNotices])

  /** Run a duel's 10 seeded spots, then hand the score to `onDone`. */
  function runDuel(seeds: ReturnType<typeof duelSeeds>, onDone: (score: number, timeMs: number) => void | Promise<void>) {
    setLadderResult(null)
    setLadderRun({
      seeds,
      startIndex: 0,
      startScore: 0,
      baseTimeMs: 0,
      onProgress: () => {},
      onComplete: async (score, timeMs) => {
        setLadderRun(null)
        await onDone(score, timeMs)
        setProgress((p) => p + 1)
        setDuelsVersion((v) => v + 1)
      },
      onExit: () => setLadderRun(null),
    })
  }

  /** Show the VS splash, then start the run. */
  function withDuelIntro(themAvatar: string, themHandle: string, start: () => void) {
    setDuelIntro({ me: equipped().avatar, them: themAvatar, handle: themHandle })
    setTimeout(() => {
      setDuelIntro(null)
      start()
    }, 1500)
  }

  function challengeFriend(opponent: { user_id: string; handle: string; avatar: string }, wager: number) {
    if (!user) return
    setTab('duels')
    const seed = newDuelSeed()
    const seeds = duelSeeds(seed)
    withDuelIntro(opponent.avatar, opponent.handle, () =>
      runDuel(seeds, (score, timeMs) =>
        createDuel({
          userId: user.id,
          opponentId: opponent.user_id,
          opponentHandle: opponent.handle,
          opponentAvatar: opponent.avatar,
          wager,
          seed,
          score,
          timeMs,
        }).then(() => {}),
      ),
    )
  }

  /** Post an open duel anyone can accept (we play our 10 spots first). */
  function createOpen(wager: number) {
    if (!user) return
    setTab('duels')
    const seed = newDuelSeed()
    const seeds = duelSeeds(seed)
    withDuelIntro(DEFAULT_AVATAR, 'an open challenge', () =>
      runDuel(seeds, (score, timeMs) =>
        createOpenDuel({ userId: user.id, wager, seed, score, timeMs }).then(() => {}),
      ),
    )
  }

  /** Play an incoming challenge or accept an open duel. The local "played" mark
   *  and the in-memory guard make the same duel un-replayable even if a refetch
   *  briefly still shows it as pending/open. */
  function playDuel(duel: DuelRow) {
    if (!user || duelGuard.current.has(duel.id)) return
    duelGuard.current.add(duel.id)
    markDuelPlayed(duel.id)
    setDuelsVersion((v) => v + 1) // drop it from the inbox/open list immediately
    const isOpen = duel.opponent == null
    const seeds = duelSeeds(duel.seed)
    withDuelIntro(duel.challenger_avatar || DEFAULT_AVATAR, duel.challenger_handle || 'Challenger', () =>
      runDuel(seeds, (score, timeMs) =>
        (isOpen ? acceptOpenDuel(duel.id, user.id, score, timeMs).then(() => {}) : answerDuel(duel.id, score, timeMs)),
      ),
    )
  }

  function onDeclineDuel(duel: DuelRow) {
    markDuelPlayed(duel.id) // also hide it locally right away
    declineDuel(duel.id).then(() => setDuelsVersion((v) => v + 1))
  }

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

  function toggleHaptics() {
    const v = !haptics
    setHaptics(v)
    setHapticsState(v)
    if (v) haptic('success') // confirm the device actually buzzes
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
        <h1 className="flex items-center justify-center text-ink">
          <Wordmark className="h-9" />
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
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2 mt-3">Feedback</p>
              <div className="flex flex-col gap-1">
                <ToggleRow label="Sound" on={!muted} onClick={toggleMute} />
                <ToggleRow label="Haptics" sub="On supported phones" on={haptics} onClick={toggleHaptics} />
              </div>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* sign-in nudge: inline banner so it never overlaps content; hidden mid-ladder */}
        {nudge && !ladderRun && (
          <div className="animate-toast mx-auto w-full max-w-xl px-4 pt-3 lg:max-w-2xl">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper2 p-3 shadow-sm">
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
          </div>
        )}
        {/* keyed so each tab change re-mounts and plays a gentle fade-up */}
        <div key={tab} className="animate-fade-up h-full">
          {tab === 'drill' && (
            <DrillScreen
              level={level}
              onProgress={() => setProgress((p) => p + 1)}
              requestFocus={focusRequest}
              onFocusConsumed={() => setFocusRequest(null)}
              difficulty={difficulty}
            />
          )}
          {tab === 'daily' &&
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
              <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto">
                <DailyChallengeCard day={dayKey()} version={dailyVersion} onPlay={startLadder} />
                <DailyLeaderboard configured={supabaseConfigured} userId={user?.id ?? null} version={dailyVersion} />
              </div>
            ))}
          {tab === 'duels' &&
            (ladderRun ? (
              <DrillScreen level={level} onProgress={() => setProgress((p) => p + 1)} ladder={ladderRun} />
            ) : (
              <DuelsScreen
                configured={supabaseConfigured}
                userId={user?.id ?? null}
                balance={pp ?? 0}
                version={duelsVersion}
                onSignIn={() => setAccountOpen(true)}
                onChallenge={challengeFriend}
                onCreateOpen={createOpen}
                onPlay={playDuel}
                onDecline={onDeclineDuel}
                onChanged={() => setProgress((p) => p + 1)}
              />
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
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {((t.id === 'profile' && friendReqCount > 0) || (t.id === 'duels' && duelReqCount > 0)) && (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold leading-none text-white"
                  >
                    {t.id === 'profile' ? friendReqCount : duelReqCount}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          )
        })}
      </nav>

      {duelIntro && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <div className="animate-deal"><Avatar id={duelIntro.me} size={72} /></div>
            <span className="serif animate-spring text-5xl font-bold text-clay" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              VS
            </span>
            <div className="animate-deal" style={{ animationDelay: '120ms' }}><Avatar id={duelIntro.them} size={72} /></div>
          </div>
        </div>
      )}

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
            style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
            className="animate-toast fixed inset-x-0 z-[60] mx-auto flex w-[20rem] max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-sage/40 bg-paper2 p-3 text-left shadow-xl"
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

      {duelNotices.length > 0 && (() => {
        const n = duelNotices[0]
        const tone = n.tone === 'win' ? 'border-sage/40' : n.tone === 'loss' ? 'border-clay/40' : 'border-line'
        const chip = n.tone === 'win' ? 'bg-sage' : n.tone === 'loss' ? 'bg-clay' : 'bg-ink3'
        return (
          <button
            key={n.id}
            onClick={() => {
              setTab('duels')
              setDuelNotices((q) => q.slice(1))
            }}
            style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
            className={`animate-toast fixed inset-x-0 z-[60] mx-auto flex w-[20rem] max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border bg-paper2 p-3 text-left shadow-xl ${tone}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white dark:text-paper ${chip}`}>
              <Swords size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{n.title}</p>
              <p className="truncate text-xs text-ink2">{n.sub}</p>
            </div>
          </button>
        )
      })()}

      {dailyInvite && tab !== 'daily' && !ladderRun && (
        <div
          className="fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="animate-pop flex w-full max-w-sm items-center gap-3 rounded-2xl border border-sage/40 bg-paper2 px-4 py-3 shadow-xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-white dark:text-paper">
              <CalendarCheck size={20} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-ink">Today's challenge is live</p>
              <p className="text-xs text-ink2">20 spots, one shot, climb the daily board.</p>
            </div>
            <button
              onClick={() => { setDailyInvite(false); setTab('daily') }}
              className="btn btn-primary shrink-0 px-3 py-1.5 text-sm"
            >
              Play
            </button>
            <button onClick={dismissDailyInvite} aria-label="Dismiss" className="shrink-0 p-1 text-ink3 hover:text-ink">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <PwaUpdater />
    </div>
  )
}

/** A labelled on/off pill switch used in the settings panel. */
function ToggleRow({ label, sub, on, onClick }: { label: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-ink/5"
    >
      <span className="flex flex-col items-start">
        <span className="font-semibold">{label}</span>
        {sub && <span className="text-[11px] text-ink3">{sub}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-sage' : 'bg-ink/20'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[1.125rem]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
