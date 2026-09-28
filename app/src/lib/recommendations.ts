import type { Evaluation } from '../types'
import { CATEGORIES, categoryById } from './questions'
import { classify, computeScore, rawValueFor } from './scoring'
import type { CategoryScore, EvaluationScore } from './scoring'

/*
 * Recommendation engine (pure, DOM-free).
 * Every piece of text below is derived from the user's actual answers and the
 * scoring result. There is no random or placeholder content.
 */

export interface StrengthItem {
  id: string
  label: string
  score100: number
}

export interface ImprovementItem {
  id: string
  label: string
  score100: number
  weakestQuestion: string
  tip: string
}

export interface AssumptionItem {
  categoryLabel: string
  statement: string
  question: string
}

export interface RiskItem {
  id: string
  label: string
  score100: number
  risk: string
  treatment: string
}

export interface RecommendationItem {
  categoryId: string
  label: string
  score100: number
  text: string
}

export interface Report {
  strengths: StrengthItem[]
  improvements: ImprovementItem[]
  assumptions: AssumptionItem[]
  risks: RiskItem[]
  recommendations: RecommendationItem[]
  immediateAction: string
  plan30: string[]
  plan90: string[]
  sustainabilityActions: string[]
  nextStepGoal: string
}

const STRENGTH_MIN = 60
const RISK_MAX = 45

function firstLower(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function scored(categories: CategoryScore[]): CategoryScore[] {
  return categories
}

function weakestAnsweredQuestion(cat: CategoryScore): { question: string; tip: string } | null {
  const answered = cat.questions
    .filter((q) => q.answered)
    .sort((a, b) => a.value! - b.value!)
  if (answered.length === 0) return null
  const first = answered[0]
  return { question: first.text, tip: first.tip }
}

function weakestQuestionForCategory(cat: CategoryScore): string {
  const weakest = weakestAnsweredQuestion(cat)
  if (weakest) return weakest.question
  const first = cat.questions[0]
  return first ? first.text : cat.label
}

export function buildReport(evaluation: Evaluation, score: EvaluationScore): Report {
  const categories = scored(score.categories)
  const catById = new Map(categories.map((c) => [c.id, c]))

  const strengths: StrengthItem[] = categories
    .filter((c) => c.score100 >= STRENGTH_MIN)
    .sort((a, b) => b.score100 - a.score100)
    .slice(0, 3)
    .map((c) => ({ id: c.id, label: c.label, score100: c.score100 }))

  const improvements: ImprovementItem[] = categories
    .filter((c) => c.score100 < STRENGTH_MIN)
    .sort((a, b) => a.score100 - b.score100)
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      label: c.label,
      score100: c.score100,
      weakestQuestion: weakestQuestionForCategory(c),
      tip: categoryById(c.id)?.improveTip ?? '',
    }))

  const weakAnswered: AssumptionItem[] = []
  for (const cat of CATEGORIES) {
    cat.questions.forEach((q, idx) => {
      const value = rawValueFor(cat, idx, evaluation.answers)
      if (value != null && value <= 2) {
        weakAnswered.push({
          categoryLabel: cat.label,
          statement:
            'You are assuming ' + firstLower(q.text),
          question: q.text,
        })
      }
    })
  }
  const assumptions: AssumptionItem[] = weakAnswered.slice(0, 5)
  if (assumptions.length === 0) {
    assumptions.push({
      categoryLabel: 'Overall',
      statement:
        'No weak answered commitments were flagged. Keep validating the strong ones as you grow.',
      question: '',
    })
  }

  const risks: RiskItem[] = categories
    .filter((c) => c.score100 < RISK_MAX)
    .sort((a, b) => a.score100 - b.score100)
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      label: c.label,
      score100: c.score100,
      risk: categoryById(c.id)?.risk ?? '',
      treatment: categoryById(c.id)?.treatment ?? '',
    }))

  const recommendations: RecommendationItem[] = categories
    .filter((c) => c.score100 < STRENGTH_MIN)
    .sort((a, b) => a.score100 - b.score100)
    .slice(0, 5)
    .map((c) => {
      const cat = categoryById(c.id)
      const weakest = weakestAnsweredQuestion(c)
      const focus = weakest ? 'the weakest signal is: \u201c' + weakest.question + '\u201d' : 'your answers there are still forming'
      return {
        categoryId: c.id,
        label: c.label,
        score100: c.score100,
        text:
          'In ' +
          c.label +
          ', ' +
          focus +
          '. Focus on ' +
          (cat?.improveTip ?? 'strengthening this area with direct customer and market evidence') +
          '.',
      }
    })

  const allAnsweredQuestions = categories.flatMap((c) =>
    c.questions
      .filter((q) => q.answered)
      .map((q) => ({ categoryLabel: c.label, value: q.value!, question: q, category: c })),
  )

  let immediateAction = ''
  if (allAnsweredQuestions.length > 0) {
    const lowest = allAnsweredQuestions
      .slice()
      .sort((a, b) => a.value - b.value)[0]
    const catTip = categoryById(lowest.category.id)?.improveTip ?? ''
    immediateAction =
      'Within the next 7 days, take one small concrete step on \u201c' +
      lowest.question.text +
      '\u201d. Start with: ' +
      (lowest.question.tip || catTip)
  } else {
    immediateAction =
      'Rate at least one question so the evaluator can suggest a focused first step for you.'
  }

  const plan30: string[] = improvements.slice(0, 3).map(
    (i) => i.label + ' \u2014 ' + (catById.get(i.id)?.description ?? i.weakestQuestion),
  )

  const plan90Sources = categories
    .slice()
    .sort((a, b) => a.score100 - b.score100)
    .filter((c) => !improvements.slice(0, 3).some((x) => x.id === c.id) && c.score100 < STRENGTH_MIN)
  const plan90: string[] = plan90Sources.slice(0, 3).map((c) => {
    const weakest = weakestAnsweredQuestion(c)
    const tip = categoryById(c.id)?.improveTip ?? ''
    return (
      c.label +
      ' \u2014 move beyond basics: test ' +
      (weakest ? '\u201c' + weakest.question.slice(0, 60) + '\u2026\u201d' : 'your delivery') +
      ' with real customers. Next step: ' +
      tip
    )
  })

  const sustainabilityOrder = ['sustainability', 'scalability-growth', 'financial-viability', 'risk-resilience']
  const sustainabilitySources = sustainabilityOrder
    .map((id) => catById.get(id))
    .filter((c): c is CategoryScore => c != null)
  const sustainabilityActions: string[] = sustainabilitySources.slice(0, 3).map((c) => {
    const cat = categoryById(c.id)
    if (c.score100 < STRENGTH_MIN) {
      return c.label + ' \u2014 ' + (cat?.improveTip ?? 'strengthen this area for the long term.')
    }
    return (
      c.label +
      ' \u2014 you are strong here. Protect this advantage by reviewing it at least once a quarter.'
    )
  })

  const topGap = improvements[0]
  const nextStepGoal = topGap
    ? 'Your first milestone is to move ' + topGap.label + ' above ' + STRENGTH_MIN + ' points by closing ' + topGap.weakestQuestion.slice(0, 80) + '.'
    : 'Your concept is strong across categories. Move from validation to a structured growth plan and protect your advantages.'

  return {
    strengths,
    improvements,
    assumptions,
    risks,
    recommendations,
    immediateAction,
    plan30,
    plan90,
    sustainabilityActions,
    nextStepGoal,
  }
}

export function summarize(evaluation: Evaluation): {
  score: EvaluationScore
  classification: string
  missedQuestions: number
} {
  const score = computeScore(evaluation.answers)
  return {
    score,
    classification: classify(score.overall).name,
    missedQuestions: score.totalQuestions - score.totalAnswered,
  }
}