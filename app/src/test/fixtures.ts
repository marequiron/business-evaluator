import type { Answers, Evaluation } from '../types'
import { answerKey } from '../lib/scoring'
import { CATEGORIES } from '../lib/questions'
import { newEvaluation } from '../lib/storage'

export function answersFor(values: Record<string, number>): Answers {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, { value: v, note: '' }]),
  )
}

export function answersForCategory(categoryId: string, values: number[]): Answers {
  const mapped: Record<string, number> = {}
  values.forEach((v, i) => {
    mapped[answerKey(categoryId, i)] = v
  })
  return answersFor(mapped)
}

export function allStrong(overrides: Record<string, number[]> = {}): Answers {
  const out: Answers = {}
  for (const cat of CATEGORIES) {
    const values = overrides[cat.id] ?? [5, 5, 5, 5]
    values.forEach((v, i) => {
      out[answerKey(cat.id, i)] = { value: v, note: '' }
    })
  }
  return out
}

export function makeEvaluation(): Evaluation {
  return newEvaluation('Test evaluation')
}

export function withAnswers(evaluation: Evaluation, answers: Answers): Evaluation {
  return { ...evaluation, answers }
}