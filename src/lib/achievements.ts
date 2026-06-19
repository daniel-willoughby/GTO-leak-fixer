// Milestones a player works toward, computed from local decision history +
// streaks + lesson progress. Pure read; no new tracking needed (the best
// streak is derived from the full decision log).

import { Spade, Target, Flame, GraduationCap, CalendarCheck, Zap, TrendingUp, type LucideIcon } from 'lucide-react'
import { db } from './db'
import { getDaily, liveStreak } from './daily'
import { lessonProgress } from './level'
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
  group: 'Volume' | 'Accuracy' | 'Streaks' | 'Learning'
  /** Poker Points granted once when this milestone is unlocked. */
  reward: number
}

/** PP reward per milestone id — tougher milestones pay more. */
export const ACHIEVEMENT_REWARD: Record<string, number> = {
  hands25: 25,
  hands100: 50,
  hands500: 100,
  acc80: 75,
  acc90: 150,
  streak10: 50,
  streak25: 100,
  streak50: 200,
  streak200: 1000, // ridiculous
  speedrun: 300,
  drilla: 200,
  daily3: 30,
  daily7: 75,
  scholar: 150,
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
  const lessonsDone = CURRICULUM.filter((l) => lessonProgress(l.id).done).length
  const fastRun = bestSpeedRun(all) // best correct streak inside a 10s window

  // "consistently improving": recent-third accuracy vs early-third accuracy.
  const third = Math.floor(all.length / 3)
  const acof = (arr: typeof all) => (arr.length ? arr.filter((d) => d.isCorrect).length / arr.length : 0)
  const improveDelta = third >= 20 ? acof(all.slice(-third)) - acof(all.slice(0, third)) : 0
  const improvePct = Math.round(improveDelta * 100)

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
    count('streak200', 'Streaks', 'Untouchable', '200 correct in a row', Flame, best, 200),
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
    count('scholar', 'Learning', 'Scholar', `Finish all ${CURRICULUM.length} lessons`, GraduationCap, lessonsDone, CURRICULUM.length),
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
