import { describe, it, expect, beforeEach } from 'vitest'
import { CURRICULUM } from '../data/curriculum'
import {
  getLevel,
  setLevel,
  lessonProgress,
  recordLessonCorrect,
  isLessonUnlocked,
  isModeUnlocked,
  curriculumComplete,
  resetCurriculum,
} from './level'

const complete = (id: string, goal: number) => {
  for (let i = 0; i < goal; i++) recordLessonCorrect(id, goal)
}

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
    const l = CURRICULUM[0]
    for (let i = 0; i < l.goal - 1; i++) expect(recordLessonCorrect(l.id, l.goal).done).toBe(false)
    expect(recordLessonCorrect(l.id, l.goal).done).toBe(true)
    expect(lessonProgress(l.id).correct).toBe(l.goal)
    expect(isLessonUnlocked(CURRICULUM[1], CURRICULUM)).toBe(true)
  })

  it('does not over-count past the goal', () => {
    const l = CURRICULUM[0]
    complete(l.id, l.goal)
    recordLessonCorrect(l.id, l.goal)
    expect(lessonProgress(l.id).correct).toBe(l.goal)
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
