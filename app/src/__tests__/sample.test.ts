import { describe, expect, it } from 'vitest'
import { createSampleEvaluation } from '../lib/sample'
import { computeScore } from '../lib/scoring'
import { BUSINESS_PARAMETERS, PRODUCTS } from '../lib/catalog'
import { buildQuote } from '../lib/quote'

const NOW = new Date('2026-03-01T00:00:00.000Z')

/*
 * The sample is a demo asset, so its *character* matters as much as its score.
 * These pins exist to fail loudly if a catalog change quietly changes what the
 * demo shows, which is the failure mode nobody notices until a pitch.
 */
describe('sample evaluation', () => {
  const evaluation = createSampleEvaluation()
  const score = computeScore(evaluation.answers)
  const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS, NOW)

  it('answers every question', () => {
    expect(score.totalAnswered).toBe(score.totalQuestions)
    expect(score.totalQuestions).toBe(40)
  })

  it('lands on the Growth tier so the discount is visible', () => {
    expect(score.overall).toBeGreaterThanOrEqual(60)
    expect(score.overall).toBeLessThan(80)
    expect(quote.tier.name).toBe('Growth')
    expect(quote.tier.discountPct).toBe(5)
  })

  it('produces a real discount to strike through', () => {
    expect(quote.discount).toBeGreaterThan(0)
    expect(quote.total).toBe(quote.subtotal - quote.discount)
  })

  it('keeps exactly one service locked, so the gate is demonstrated', () => {
    expect(quote.lockedCount).toBe(1)
    expect(quote.eligibleCount).toBe(PRODUCTS.length - 1)
    const locked = quote.lines.filter((l) => !l.eligible)
    expect(locked.map((l) => l.product.id)).toEqual(['operations-blueprint'])
    // It must be held back by scalability specifically, not by accident.
    expect(locked[0].reason).toContain('Scalability')
  })

  it('reports both a sequential and a parallel timeline', () => {
    expect(quote.sequentialWeeks).toBeGreaterThan(quote.parallelWeeks)
    expect(quote.parallelism).toBe(2)
  })
})
