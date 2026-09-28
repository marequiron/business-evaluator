import type { Answers } from '../types'
import { CATEGORIES } from './questions'
import type { Category, Question } from './questions'

/*
 * Scoring module (pure, DOM-free, fully unit-tested).
 *
 * Weights — each category contributes to the overall score in proportion to
 * how foundational it is to a healthy new business. The weights sum to 100%.
 *
 *   customer-problem           14%
 *   market-opportunity         12%
 *   value-proposition          12%
 *   competitive-advantage       8%
 *   operational-feasibility    10%
 *   financial-viability        14%
 *   risk-resilience            10%
 *   sustainability              6%
 *   scalability-growth          8%
 *   founder-readiness           6%
 *   -------------------------------
 *   total                     100%
 *
 * Score mapping: an answer of 1..5 maps to points 0..100 via
 * (value - 1) / 4 * 100.
 *
 * Unanswered questions are NEVER treated as a positive result. They receive 0
 * points and still count in the denominator, so skipping questions honestly
 * lowers the category score. The result marks unanswered questions clearly.
 */

export interface AnswerKeyParts {
  categoryId: string
  questionIndex: number
}

export function answerKey(categoryId: string, questionIndex: number): string {
  return categoryId + '__' + questionIndex
}

export function parseAnswerKey(key: string): AnswerKeyParts {
  const idx = key.lastIndexOf('__')
  return {
    categoryId: key.slice(0, idx),
    questionIndex: Number(key.slice(idx + 2)),
  }
}

export const ANSWER_LABELS: Record<number, string> = {
  1: 'Not yet established',
  2: 'Needs major improvement',
  3: 'Partially established',
  4: 'Strong',
  5: 'Very strong',
}

export function answerLabel(value: number | null): string {
  if (value == null) return 'Not answered'
  return ANSWER_LABELS[value] ?? 'Not a valid rating'
}

export const CATEGORY_WEIGHTS: Record<string, number> = {
  'customer-problem': 14,
  'market-opportunity': 12,
  'value-proposition': 12,
  'competitive-advantage': 8,
  'operational-feasibility': 10,
  'financial-viability': 14,
  'risk-resilience': 10,
  sustainability: 6,
  'scalability-growth': 8,
  'founder-readiness': 6,
}

export const CATEGORY_WEIGHTS_TOTAL: number = Object.values(CATEGORY_WEIGHTS).reduce(
  (sum, w) => sum + w,
  0,
)

export function weightFor(categoryId: string): number {
  return CATEGORY_WEIGHTS[categoryId] ?? 0
}

export interface QuestionResult {
  index: number
  text: string
  why: string
  value: number | null
  points: number
  answered: boolean
  note: string
  tip: string
}

export interface CategoryScore {
  id: string
  label: string
  description: string
  weight: number
  score100: number
  answeredCount: number
  unansweredCount: number
  questionCount: number
  questions: QuestionResult[]
}

export interface EvaluationScore {
  categories: CategoryScore[]
  overall: number
  totalAnswered: number
  totalQuestions: number
  completion: number
}

export function encouragementFor(value: number | null, question: Question | undefined): string {
  const tip = question?.tip ?? ''
  if (value == null) {
    return 'Not answered yet. Once you rate this question you will see tailored encouragement here.'
  }
  if (value <= 2) {
    return 'This is early stage, not a verdict. Many strong businesses start exactly here. ' + tip
  }
  if (value === 3) {
    return 'A solid foundation. With focused effort, this can become a genuine strength before you launch.'
  }
  if (value === 4) {
    return 'Strong. This is becoming a real advantage, so build on it deliberately.'
  }
  return 'Very strong. This is a cornerstone of your idea, protect it and lean on it.'
}

export function rawValueFor(category: Category, idx: number, answers: Answers): number | null {
  const raw = answers[answerKey(category.id, idx)]
  const value = raw && typeof raw.value === 'number' && raw.value >= 1 && raw.value <= 5 ? raw.value : null
  return value
}

function pointsFor(category: Category, answers: Answers): (number | null)[] {
  return category.questions.map((_, idx) => {
    const value = rawValueFor(category, idx, answers)
    return value == null ? null : ((value - 1) / 4) * 100
  })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function computeScore(answers: Answers, categories: Category[] = CATEGORIES): EvaluationScore {
  const categoryScores: CategoryScore[] = categories.map((cat) => {
    const points = pointsFor(cat, answers)
    const questionResults: QuestionResult[] = cat.questions.map((q, idx) => {
      const raw = answers[answerKey(cat.id, idx)]
      const value = rawValueFor(cat, idx, answers)
      return {
        index: idx,
        text: q.text,
        why: q.why,
        tip: q.tip,
        value,
        points: points[idx] ?? 0,
        answered: value != null,
        note: raw?.note ?? '',
      }
    })

    const answeredCount = questionResults.filter((q) => q.answered).length
    const questionCount = cat.questions.length
    const score100 = round1(
      questionResults.reduce((sum, q) => sum + q.points, 0) / Math.max(questionCount, 1),
    )

    return {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      weight: weightFor(cat.id),
      score100,
      answeredCount,
      unansweredCount: questionCount - answeredCount,
      questionCount,
      questions: questionResults,
    }
  })

  const totalQuestions = categoryScores.reduce((sum, c) => sum + c.questionCount, 0)
  const totalAnswered = categoryScores.reduce((sum, c) => sum + c.answeredCount, 0)
  const weighted = categoryScores.reduce(
    (sum, c) => sum + (score100Weighted(c)),
    0,
  )
  const overall = Math.round(weighted / Math.max(CATEGORY_WEIGHTS_TOTAL, 1))

  return {
    categories: categoryScores,
    overall,
    totalAnswered,
    totalQuestions,
    completion: totalQuestions === 0 ? 0 : Math.round((totalAnswered / totalQuestions) * 100),
  }
}

function score100Weighted(c: CategoryScore): number {
  return c.score100 * c.weight
}

export interface Classification {
  name: string
  description: string
  tone: 'low' | 'medium' | 'high' | 'top'
}

export const CLASSIFICATIONS: Classification[] = [
  {
    name: 'Early concept requiring validation',
    description:
      'Your idea has a seed of promise, but the foundations are largely unproven. The fastest path forward is validation, not more planning.',
    tone: 'low',
  },
  {
    name: 'Promising but needs improvement',
    description:
      'There is real substance here, with specific gaps that need work. Targeting the weakest areas will raise your score quickly.',
    tone: 'medium',
  },
  {
    name: 'Strong concept with manageable gaps',
    description:
      'This is a solid concept with a few defined gaps worth closing before serious scale. The gaps are clear and addressable.',
    tone: 'high',
  },
  {
    name: 'Presentation-ready concept requiring continued validation',
    description:
      'Your idea is ready to present with confidence. Keep validating assumptions and stress-testing the weakest categories over time.',
    tone: 'top',
  },
]

export function classify(overall: number): Classification {
  if (overall < 40) return CLASSIFICATIONS[0]
  if (overall < 60) return CLASSIFICATIONS[1]
  if (overall < 80) return CLASSIFICATIONS[2]
  return CLASSIFICATIONS[3]
}