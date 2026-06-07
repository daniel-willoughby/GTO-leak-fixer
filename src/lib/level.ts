// Experience level (beginner vs intermediate) + beginner curriculum progress.
// Stored in localStorage like 'lt-difficulty' — small, structured, no Dexie
// migration needed.

import type { Lesson } from '../data/curriculum'

export type Level = 'beginner' | 'intermediate'

const LEVEL_KEY = 'lt-level'
const LESSONS_KEY = 'lt-lessons'

export function getLevel(): Level | null {
  const v = localStorage.getItem(LEVEL_KEY)
  return v === 'beginner' || v === 'intermediate' ? v : null
}

export function setLevel(level: Level): void {
  localStorage.setItem(LEVEL_KEY, level)
}

export interface LessonState {
  correct: number
  done: boolean
}
type LessonMap = Record<string, LessonState>

function readMap(): LessonMap {
  try {
    return JSON.parse(localStorage.getItem(LESSONS_KEY) || '{}') as LessonMap
  } catch {
    return {}
  }
}
function writeMap(m: LessonMap): void {
  localStorage.setItem(LESSONS_KEY, JSON.stringify(m))
}

export function lessonProgress(id: string): LessonState {
  return readMap()[id] ?? { correct: 0, done: false }
}

/** Record one correct answer; marks the lesson done when the goal is reached. */
export function recordLessonCorrect(id: string, goal: number): LessonState {
  const m = readMap()
  const cur = m[id] ?? { correct: 0, done: false }
  cur.correct = Math.min(goal, cur.correct + 1)
  if (cur.correct >= goal) cur.done = true
  m[id] = cur
  writeMap(m)
  return cur
}

export function completeLesson(id: string): void {
  const m = readMap()
  m[id] = { correct: m[id]?.correct ?? 0, done: true }
  writeMap(m)
}

/** A lesson is unlocked when it is the first one, or the previous is done. */
export function isLessonUnlocked(lesson: Lesson, all: Lesson[]): boolean {
  const idx = all.findIndex((l) => l.id === lesson.id)
  if (idx <= 0) return true
  return lessonProgress(all[idx - 1].id).done
}

/** First not-yet-done lesson, or null when the whole curriculum is complete. */
export function nextLessonId(all: Lesson[]): string | null {
  return all.find((l) => !lessonProgress(l.id).done)?.id ?? null
}

export function curriculumComplete(all: Lesson[]): boolean {
  return all.every((l) => lessonProgress(l.id).done)
}

/** Drill modes a beginner has unlocked via the matching capstone lesson. */
export function isModeUnlocked(mode: 'multiway' | 'postflop'): boolean {
  return lessonProgress(mode).done
}

export function resetCurriculum(): void {
  localStorage.removeItem(LESSONS_KEY)
}
