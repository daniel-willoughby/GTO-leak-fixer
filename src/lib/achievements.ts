// Milestones a player works toward, computed from local decision history +
// streaks + lesson progress. Pure read; no new tracking needed (the best
// streak is derived from the full decision log).

import { Spade, Target, Flame, GraduationCap, CalendarCheck, Zap, TrendingUp, Trophy, Shirt, Crown, Swords, Coins, type LucideIcon } from 'lucide-react'
import { db } from './db'
import { getDaily, liveStreak } from './daily'
import { lessonProgress } from './level'
import { equipped, dailyResults, dailyWinsClaimed, duelStats } from './points'
import { DEFAULT_AVATAR, DEFAULT_FLAIR, DEFAULT_BACKGROUND } from './shop'
import { CURRICULUM } from '../data/curriculum'

export interface Achievement {
  id: string
  title: string
  desc: string
  icon: LucideIcon
  /** Progress 0..1 toward the milestone. */
  progress: number
  /** Human label for the current state, e.g. "73 / 100" or "82% / 90%". */
  label: string
  done: boolean
  /** Grouping for the screen. */
  group: 'Volume' | 'Accuracy' | 'Streaks' | 'Learning' | 'Collection' | 'Duels'
  /** Poker Points granted once when this milestone is unlocked. */
  reward: number
}

/** PP reward per milestone id, tougher milestones pay more. */
export const ACHIEVEMENT_REWARD: Record<string, number> = {
  hands25: 25,
  hands100: 50,
  hands500: 100,
  acc80: 75,
  acc90: 150,
  streak10: 50,
  streak25: 100,
  streak50: 200,
  streak100: 400,
  streak200: 1000, // ridiculous
  speedrun: 300,
  drilla: 200,
  tiltproof: 150,
  fashionista: 200,
  daily3: 30,
  daily7: 75,
  crown1: 100,
  crown5: 350,
  crown10: 800,
  lessons1: 25,
  lessons5: 75,
  lessons10: 150,
  scholar: 300,
  duel1: 30,
  duel10: 120,
  duelwin1: 60,
  duelwin10: 300,
  duelrich: 250,
}

/** Largest run of consecutive-correct decisions that fits inside `windowMs`.
 *  Used for The Speedrunner (20 correct in a row in under 10 seconds). */
function bestSpeedRun(rows: { ts: number; isCorrect: boolean }[], windowMs = 10_000): number {
  let best = 0
  let runStart = 0
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].isCorrect) {
      runStart = i + 1
      continue
    }
    let j = i
    while (j > runStart && rows[i].ts - rows[j - 1].ts <= windowMs) j--
    best = Math.max(best, i - j + 1)
  }
  return best
}

function longestRun(flags: boolean[]): number {
  let best = 0
  let cur = 0
  for (const ok of flags) {
    cur = ok ? cur + 1 : 0
    if (cur > best) best = cur
  }
  return best
}

export async function getAchievements(): Promise<Achievement[]> {
  const all = await db.decisions.orderBy('ts').toArray()
  const total = all.length
  const last100 = all.slice(-100)
  const accPct = last100.length ? Math.round((last100.filter((d) => d.isCorrect).length / last100.length) * 100) : 0
  const best = longestRun(all.map((d) => d.isCorrect))
  const dayStreak = liveStreak(getDaily())
  const crownCount = dailyWinsClaimed().length // times you topped the daily at reset
  const duels = duelStats() // head-to-head play/win tallies + net PP
  const lessonsDone = CURRICULUM.filter((l) => lessonProgress(l.id).done).length
  const fastRun = bestSpeedRun(all) // best correct streak inside a 10s window

  // "consistently improving": recent-third accuracy vs early-third accuracy.
  const third = Math.floor(all.length / 3)
  const acof = (arr: typeof all) => (arr.length ? arr.filter((d) => d.isCorrect).length / arr.length : 0)
  const improveDelta = third >= 20 ? acof(all.slice(-third)) - acof(all.slice(0, third)) : 0
  const improvePct = Math.round(improveDelta * 100)

  // best daily-ladder score (out of 20) for Tilt-Proof
  const bestDaily = Math.max(0, ...Object.values(dailyResults()).map((r) => r.score))
  // how many cosmetic slots are off their default, for Fashionista
  const eq = equipped()
  const dressed =
    (eq.avatar !== DEFAULT_AVATAR ? 1 : 0) +
    (eq.flair !== DEFAULT_FLAIR ? 1 : 0) +
    (eq.background !== DEFAULT_BACKGROUND ? 1 : 0)

  // a count milestone: current value out of a target
  const count = (
    id: string,
    group: Achievement['group'],
    title: string,
    desc: string,
    icon: LucideIcon,
    current: number,
    target: number,
  ): Achievement => ({
    id,
    group,
    title,
    desc,
    icon,
    progress: Math.min(1, current / target),
    label: `${Math.min(current, target)} / ${target}`,
    done: current >= target,
    reward: ACHIEVEMENT_REWARD[id] ?? 0,
  })

  // an accuracy milestone: % over the last 100 hands, only counts once 100 deep
  const acc = (id: string, title: string, desc: string, target: number): Achievement => {
    const ready = total >= 100
    return {
      id,
      group: 'Accuracy',
      title,
      desc,
      icon: Target,
      progress: ready ? Math.min(1, accPct / target) : Math.min(0.95, total / 100),
      label: ready ? `${accPct}% / ${target}%` : `${total} / 100 hands`,
      done: ready && accPct >= target,
      reward: ACHIEVEMENT_REWARD[id] ?? 0,
    }
  }

  return [
    count('hands25', 'Volume', 'First steps', 'Play 25 hands', Spade, total, 25),
    count('hands100', 'Volume', 'Getting reps', 'Play 100 hands', Spade, total, 100),
    count('hands500', 'Volume', 'Grinder', 'Play 500 hands', Spade, total, 500),
    acc('acc80', 'Sharp', 'Hit 80% over your last 100 hands', 80),
    acc('acc90', 'Marksman', 'Hit 90% over your last 100 hands', 90),
    count('streak10', 'Streaks', 'Heating up', '10 correct in a row', Flame, best, 10),
    count('streak25', 'Streaks', 'On fire', '25 correct in a row', Flame, best, 25),
    count('streak50', 'Streaks', 'Locked in', '50 correct in a row', Flame, best, 50),
    count('streak100', 'Streaks', 'Centurion', '100 correct in a row', Flame, best, 100),
    count('streak200', 'Streaks', 'Untouchable', '200 correct in a row', Flame, best, 200),
    {
      id: 'tiltproof',
      group: 'Streaks',
      title: 'Tilt-Proof',
      desc: 'Finish a daily ladder with a perfect 20/20',
      icon: Trophy,
      progress: Math.min(1, bestDaily / 20),
      label: `${bestDaily} / 20`,
      done: bestDaily >= 20,
      reward: ACHIEVEMENT_REWARD.tiltproof,
    },
    {
      id: 'speedrun',
      group: 'Streaks',
      title: 'The Speedrunner',
      desc: '20 correct in a row in under 10 seconds',
      icon: Zap,
      progress: Math.min(1, fastRun / 20),
      label: `${Math.min(fastRun, 20)} / 20`,
      done: fastRun >= 20,
      reward: ACHIEVEMENT_REWARD.speedrun,
    },
    {
      id: 'drilla',
      group: 'Accuracy',
      title: 'My Drilla',
      desc: 'Lift your accuracy 15% from where you started',
      icon: TrendingUp,
      progress: third >= 20 ? Math.min(1, Math.max(0, improveDelta) / 0.15) : Math.min(0.95, all.length / 60),
      label: third >= 20 ? `+${Math.max(0, improvePct)}% / +15%` : `${all.length} / 60 hands`,
      done: third >= 20 && improveDelta >= 0.15,
      reward: ACHIEVEMENT_REWARD.drilla,
    },
    count('daily3', 'Streaks', 'Daily habit', 'Keep a 3-day streak', CalendarCheck, dayStreak, 3),
    count('daily7', 'Streaks', 'Week strong', 'Keep a 7-day streak', CalendarCheck, dayStreak, 7),
    count('crown1', 'Streaks', 'Crowned', 'Top the daily ladder once', Crown, crownCount, 1),
    count('crown5', 'Streaks', 'Daily royalty', 'Top the daily ladder 5 times', Crown, crownCount, 5),
    count('crown10', 'Streaks', 'Daily dynasty', 'Top the daily ladder 10 times', Crown, crownCount, 10),
    count('lessons1', 'Learning', 'First lesson', 'Finish your first lesson', GraduationCap, lessonsDone, 1),
    count('lessons5', 'Learning', 'Bookworm', 'Finish 5 lessons', GraduationCap, lessonsDone, 5),
    count('lessons10', 'Learning', 'Honor roll', 'Finish 10 lessons', GraduationCap, lessonsDone, 10),
    count('scholar', 'Learning', 'Scholar', `Finish all ${CURRICULUM.length} lessons`, GraduationCap, lessonsDone, CURRICULUM.length),
    {
      id: 'fashionista',
      group: 'Collection',
      title: 'Fashionista',
      desc: 'Equip a custom avatar, flair and background at once',
      icon: Shirt,
      progress: dressed / 3,
      label: `${dressed} / 3`,
      done: dressed >= 3,
      reward: ACHIEVEMENT_REWARD.fashionista,
    },
    count('duel1', 'Duels', 'Pistols at dawn', 'Play your first duel', Swords, duels.played, 1),
    count('duel10', 'Duels', 'Duelist', 'Play 10 duels', Swords, duels.played, 10),
    count('duelwin1', 'Duels', 'First blood', 'Win a duel', Trophy, duels.won, 1),
    count('duelwin10', 'Duels', 'Gunslinger', 'Win 10 duels', Trophy, duels.won, 10),
    count('duelrich', 'Duels', 'Bounty hunter', 'Win 1,000 PP from duels (net)', Coins, Math.max(0, duels.net), 1000),
  ]
}

const SEEN_KEY = 'lt-achieved'

/**
 * Returns achievements newly completed since the last check, and records them
 * so they only pop once. First run seeds the baseline silently (no flood of
 * pops for a returning player who already earned things).
 */
export async function newlyEarned(): Promise<Achievement[]> {
  const items = await getAchievements()
  const doneIds = items.filter((a) => a.done).map((a) => a.id)
  const raw = localStorage.getItem(SEEN_KEY)
  if (raw === null) {
    localStorage.setItem(SEEN_KEY, JSON.stringify(doneIds))
    return []
  }
  let seen: string[] = []
  try {
    seen = JSON.parse(raw) as string[]
  } catch {
    seen = []
  }
  const seenSet = new Set(seen)
  const fresh = items.filter((a) => a.done && !seenSet.has(a.id))
  if (fresh.length) localStorage.setItem(SEEN_KEY, JSON.stringify([...seenSet, ...fresh.map((a) => a.id)]))
  return fresh
}

/**
 * Fold every currently-unlocked achievement into the "seen" set *without*
 * popping anything. Call this right after a sign-in sync: the sync pulls a
 * whole history in at once, and without this the next `newlyEarned()` would
 * flood the player with pops (and "+PP") for achievements they unlocked long
 * ago, which reads as re-earning the same achievement on every login.
 */
export async function markAchievementsSeen(): Promise<void> {
  const items = await getAchievements()
  const doneIds = items.filter((a) => a.done).map((a) => a.id)
  let seen: string[] = []
  const raw = localStorage.getItem(SEEN_KEY)
  if (raw) {
    try {
      seen = JSON.parse(raw) as string[]
    } catch {
      seen = []
    }
  }
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...doneIds])]))
}
