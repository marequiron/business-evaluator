import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../lib/questions'
import { computeScore } from '../lib/scoring'
import { buildReport } from '../lib/recommendations'
import { answersForCategory, allStrong, makeEvaluation, withAnswers } from '../test/fixtures'
import { createSampleEvaluation } from '../lib/sample'

describe('results generation from different answer combinations', () => {
  it('produces a different classification for strong vs weak answer sets', () => {
    const allWeak = Object.fromEntries(CATEGORIES.map((c) => [c.id, [1, 1, 1, 1]]))
    const weakEval = withAnswers(makeEvaluation(), allStrong(allWeak))
    const strongEval = withAnswers(makeEvaluation(), allStrong())
    const weakScore = computeScore(weakEval.answers)
    const strongScore = computeScore(strongEval.answers)
    expect(weakScore.overall).toBeLessThan(40)
    expect(strongScore.overall).toBeGreaterThanOrEqual(80)
  })

  it('lists the lowest-scoring categories as the top improvements', () => {
    const evalLowFinancial = withAnswers(
      makeEvaluation(),
      allStrong({ 'financial-viability': [1, 1, 1, 1] }),
    )
    const score = computeScore(evalLowFinancial.answers)
    const report = buildReport(evalLowFinancial, score)
    expect(report.improvements[0].id).toBe('financial-viability')
  })

  it('names risks for categories below the risk threshold', () => {
    const evalWithRisks = withAnswers(
      makeEvaluation(),
      allStrong({ 'risk-resilience': [1, 1, 1, 1] }),
    )
    const score = computeScore(evalWithRisks.answers)
    const report = buildReport(evalWithRisks, score)
    expect(report.risks.some((r) => r.id === 'risk-resilience')).toBe(true)
    expect(report.risks[0].risk.length).toBeGreaterThan(20)
    expect(report.risks[0].treatment.length).toBeGreaterThan(20)
  })

  it('flags weak answered commitments as critical assumptions', () => {
    const oneStrongOneWeak = {
      ...answersForCategory('sustainability', [5, 5, 5, 5]),
      ...answersForCategory('financial-viability', [5, 1, 5, 5]),
    }
    const ev = withAnswers(makeEvaluation(), oneStrongOneWeak)
    const score = computeScore(ev.answers)
    const report = buildReport(ev, score)
    expect(report.assumptions.length).toBeGreaterThan(0)
    expect(report.assumptions[0].statement).toContain('assuming')
  })

  it('builds a 30-day, 90-day, and sustainability plan from the answers', () => {
    const ev = withAnswers(makeEvaluation(), {
      ...answersForCategory('customer-problem', [2, 2, 2, 2]),
      ...answersForCategory('market-opportunity', [3, 3, 3, 3]),
      ...answersForCategory('sustainability', [4, 4, 4, 4]),
    })
    const score = computeScore(ev.answers)
    const report = buildReport(ev, score)
    expect(report.plan30.length).toBe(3)
    expect(report.plan90.length).toBeGreaterThan(0)
    expect(report.sustainabilityActions.length).toBe(3)
    expect(report.immediateAction.length).toBeGreaterThan(10)
    expect(report.nextStepGoal.length).toBeGreaterThan(10)
  })

  it('uses recommendations that reference the weakest answered question', () => {
    const ev = withAnswers(
      makeEvaluation(),
      allStrong({ 'scalability-growth': [4, 4, 4, 1] }),
    )
    const score = computeScore(ev.answers)
    const report = buildReport(ev, score)
    const rec = report.recommendations.find((r) => r.categoryId === 'scalability-growth')
    expect(rec).toBeDefined()
    const weakest = CATEGORIES.find((c) => c.id === 'scalability-growth')!.questions[3].text
    expect(rec!.text).toContain(weakest.slice(0, 25))
  })

  it('produces recommendations and plans for the sample business', () => {
    const sample = createSampleEvaluation()
    const score = computeScore(sample.answers)
    const report = buildReport(sample, score)
    expect(report.strengths.length).toBeGreaterThan(0)
    expect(report.risks.length).toBeGreaterThan(0)
    expect(report.recommendations.length).toBeGreaterThan(0)
    expect(score.overall).toBeGreaterThanOrEqual(40)
    expect(score.overall).toBeLessThan(80)
  })
})