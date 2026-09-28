import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../lib/questions'
import {
  answerKey,
  answerLabel,
  CLASSIFICATIONS,
  classify,
  computeScore,
  CATEGORY_WEIGHTS,
  CATEGORY_WEIGHTS_TOTAL,
  encouragementFor,
} from '../lib/scoring'
import { answersForCategory, allStrong } from '../test/fixtures'

describe('scoring', () => {
  it('maps each answer value to the documented 0-100 points', () => {
    const answers = answersForCategory('customer-problem', [1, 2, 3, 4])
    const score = computeScore(answers)
    const cat = score.categories.find((c) => c.id === 'customer-problem')
    expect(cat).toBeDefined()
    // points: 0, 25, 50, 75 -> avg 37.5
    expect(cat!.score100).toBe(37.5)
    expect(cat!.answeredCount).toBe(4)
    expect(cat!.unansweredCount).toBe(0)
  })

  it('computes a perfect category score for all 5s', () => {
    const answers = allStrong()
    const score = computeScore(answers)
    const cat = score.categories.find((c) => c.id === 'value-proposition')
    expect(cat!.score100).toBe(100)
    expect(score.overall).toBe(100)
    expect(score.totalAnswered).toBe(score.totalQuestions)
  })

  it('treats unanswered questions as honest zeroes, not positives', () => {
    // One answered question at 5 on a 4-question category.
    const answers = answersForCategory('risk-resilience', [5])
    const score = computeScore(answers)
    const cat = score.categories.find((c) => c.id === 'risk-resilience')
    expect(cat!.answeredCount).toBe(1)
    expect(cat!.unansweredCount).toBe(3)
    // points total 100 over 4 questions -> 25.0, NOT 100.
    expect(cat!.score100).toBe(25)
    expect(score.totalAnswered).toBe(1)
    expect(score.totalQuestions).toBe(CATEGORIES.reduce((s, c) => s + c.questions.length, 0))
  })

  it('scores an entirely unanswered category as 0 with all questions marked unanswered', () => {
    const score = computeScore({})
    const allUnanswered = score.categories.every((c) => c.score100 === 0 && c.unansweredCount === c.questionCount)
    expect(allUnanswered).toBe(true)
    expect(score.overall).toBe(0)
  })

  it('weights the overall score using the documented category weights that sum to 100', () => {
    expect(CATEGORY_WEIGHTS_TOTAL).toBe(100)
    for (const cat of CATEGORIES) {
      expect(CATEGORY_WEIGHTS[cat.id]).toBeTypeOf('number')
      expect(CATEGORY_WEIGHTS[cat.id]).toBeGreaterThan(0)
    }
  })

  it('reflects that a strong high-weight category lifts the overall score more', () => {
    // financial-viability carries weight 14.
    const strongFinancial = {
      ...answersForCategory('financial-viability', [5, 5, 5, 5]),
      ...answersForCategory('operational-feasibility', [1, 1, 1, 1]),
    }
    const scoreA = computeScore(strongFinancial)

    const strongOperations = {
      ...answersForCategory('operational-feasibility', [5, 5, 5, 5]),
      ...answersForCategory('financial-viability', [1, 1, 1, 1]),
    }
    const scoreB = computeScore(strongOperations)

    expect(scoreA.overall).toBeGreaterThan(scoreB.overall)
  })

  it('matches the documented classification bands', () => {
    expect(classify(0).name).toBe(CLASSIFICATIONS[0].name)
    expect(classify(39).name).toBe(CLASSIFICATIONS[0].name)
    expect(classify(40).name).toBe(CLASSIFICATIONS[1].name)
    expect(classify(59).name).toBe(CLASSIFICATIONS[1].name)
    expect(classify(60).name).toBe(CLASSIFICATIONS[2].name)
    expect(classify(79).name).toBe(CLASSIFICATIONS[2].name)
    expect(classify(80).name).toBe(CLASSIFICATIONS[3].name)
    expect(classify(100).name).toBe(CLASSIFICATIONS[3].name)
  })

  it('labels and encourages each scale value', () => {
    expect(answerLabel(1)).toBe('Not yet established')
    expect(answerLabel(5)).toBe('Very strong')
    expect(answerLabel(null)).toBe('Not answered')
    expect(encouragementFor(1, undefined)).toContain('not a verdict')
    expect(encouragementFor(5, undefined)).toContain('cornerstone')
  })

  it('rounds overall to an integer and reports completion as a percentage', () => {
    const score = computeScore(allStrong())
    expect(Number.isInteger(score.overall)).toBe(true)
    expect(score.completion).toBe(100)
    expect(answerKey('customer-problem', 0)).toBe('customer-problem__0')
  })
})