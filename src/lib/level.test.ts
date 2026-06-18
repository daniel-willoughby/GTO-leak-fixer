import { describe, it, expect, beforeEach } from 'vitest'
import { CURRICULUM } from '../data/curriculum'
import {
  getLevel,
  setLevel,
  lessonProgress,
  recordLessonCorrect,
  completeLesson,
  isLessonUnlocked,
  isModeUnlocked,
  curriculumComplete,
  resetCurriculum,
} from './level'

// Read-only primer lessons (the core principles) carry no goal; they complete
// on read. Drill lessons complete by reaching their goal.
const complete = (id: string, goal?: number) => {
  if (!goal) completeLesson(id)
  else for (let i = 0; i < goal; i++) recordLessonCorrect(id, goal)
}

// the first lesson that actually drills (the principles come first, read-only)
const firstDrill = CURRICULUM.find((l) => !l.readOnly && l.goal)!
const drillIdx = CURRICULUM.indexOf(firstDrill)

beforeEach(() => localStorage.clear())

describe('experience level', () => {
  it('persists the chosen level', () => {
    expect(getLevel()).toBeNull()
    setLevel('beginner')
    expect(getLevel()).toBe('beginner')
  })
})

describe('curriculum progression', () => {
  it('only the first lesson is unlocked at the start', () => {
    expect(isLessonUnlocked(CURRICULUM[0], CURRICULUM)).toBe(true)
    expect(isLessonUnlocked(CURRICULUM[1], CURRICULUM)).toBe(false)
  })

  it('marks a lesson done at its goal and unlocks the next', () => {
    const goal = firstDrill.goal!
    for (let i = 0; i < goal - 1; i++) expect(recordLessonCorrect(firstDrill.id, goal).done).toBe(false)
    expect(recordLessonCorrect(firstDrill.id, goal).done).toBe(true)
    expect(lessonProgress(firstDrill.id).correct).toBe(goal)
    expect(isLessonUnlocked(CURRICULUM[drillIdx + 1], CURRICULUM)).toBe(true)
  })

  it('does not over-count past the goal', () => {
    const goal = firstDrill.goal!
    complete(firstDrill.id, goal)
    recordLessonCorrect(firstDrill.id, goal)
    expect(lessonProgress(firstDrill.id).correct).toBe(goal)
  })

  it('completes a read-only primer by reading it', () => {
    const primer = CURRICULUM.find((l) => l.readOnly)!
    expect(lessonProgress(primer.id).done).toBe(false)
    completeLesson(primer.id)
    expect(lessonProgress(primer.id).done).toBe(true)
  })

  it('unlocks advanced modes only once their capstone is done', () => {
    expect(isModeUnlocked('postflop')).toBe(false)
    complete('postflop', 6)
    expect(isModeUnlocked('postflop')).toBe(true)
  })

  it('reports completion and resets cleanly', () => {
    for (const l of CURRICULUM) complete(l.id, l.goal)
    expect(curriculumComplete(CURRICULUM)).toBe(true)
    resetCurriculum()
    expect(curriculumComplete(CURRICULUM)).toBe(false)
    expect(lessonProgress(CURRICULUM[0].id).done).toBe(false)
  })
})
