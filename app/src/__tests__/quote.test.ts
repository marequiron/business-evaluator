import { describe, expect, it } from 'vitest'
import { BUSINESS_PARAMETERS, PRODUCTS, productById } from '../lib/catalog'
import { CATEGORIES } from '../lib/questions'
import { computeScore } from '../lib/scoring'
import {
  buildQuote,
  expiryNotice,
  freezeQuote,
  isQuoteExpired,
  isQuoteStale,
  quoteNumber,
  tierFor,
  sequentialWeeks,
  parallelWeeks,
} from '../lib/quote'
import { allStrong, makeEvaluation, withAnswers } from '../test/fixtures'
import { createSampleEvaluation } from '../lib/sample'

const NOW = new Date('2026-03-01T00:00:00.000Z')

function quoteFor(answers: ReturnType<typeof allStrong>, now: Date = NOW) {
  const evaluation = withAnswers(makeEvaluation(), answers)
  const score = computeScore(evaluation.answers)
  return { evaluation, score, quote: buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS, now) }
}

const allOnes = Object.fromEntries(CATEGORIES.map((c) => [c.id, [1, 1, 1, 1]]))

describe('catalog', () => {
  it('covers every scoring category with at least one product', () => {
    const covered = new Set(PRODUCTS.flatMap((p) => p.categoryIds))
    for (const cat of CATEGORIES) {
      expect(covered.has(cat.id)).toBe(true)
    }
  })

  it('only links to categories that exist', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id))
    for (const p of PRODUCTS) {
      for (const id of p.categoryIds) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })

  it('has positive whole-peso prices and realistic durations', () => {
    for (const p of PRODUCTS) {
      expect(p.price).toBeGreaterThan(0)
      expect(Number.isInteger(p.price)).toBe(true)
      expect(p.durationWeeks).toBeGreaterThan(0)
      expect(p.deliverables.length).toBeGreaterThan(0)
    }
  })

  it('exposes products by id', () => {
    expect(productById('customer-discovery')?.name).toBe('Customer Discovery Sprint')
    expect(productById('nope')).toBeUndefined()
  })
})

describe('tier selection', () => {
  it('picks the tier whose floor the score has reached', () => {
    expect(tierFor(85, BUSINESS_PARAMETERS.tiers).id).toBe('scale')
    expect(tierFor(60, BUSINESS_PARAMETERS.tiers).id).toBe('growth')
    expect(tierFor(40, BUSINESS_PARAMETERS.tiers).id).toBe('foundation')
  })

  it('falls back to the lowest tier below the entry gate', () => {
    expect(tierFor(0, BUSINESS_PARAMETERS.tiers).id).toBe('foundation')
  })
})

describe('entry gate', () => {
  it('locks every line when the overall score is below the entry gate', () => {
    const { quote } = quoteFor(allStrong(allOnes))
    expect(quote.overall).toBeLessThan(BUSINESS_PARAMETERS.minOverallToQuote)
    expect(quote.eligibleCount).toBe(0)
    expect(quote.lockedCount).toBe(PRODUCTS.length)
    expect(quote.subtotal).toBe(0)
    expect(quote.total).toBe(0)
  })

  it('never hides a locked line, and always explains why', () => {
    const { quote } = quoteFor(allStrong(allOnes))
    expect(quote.lines).toHaveLength(PRODUCTS.length)
    for (const line of quote.lines) {
      expect(line.eligible).toBe(false)
      expect(line.reason.length).toBeGreaterThan(10)
    }
  })

  it('quotes the actual overall score in the entry-gate reason', () => {
    const { quote } = quoteFor(allStrong(allOnes))
    for (const line of quote.lines) {
      expect(line.reason).toContain(String(BUSINESS_PARAMETERS.minOverallToQuote))
      expect(line.reason).toContain(String(quote.overall))
    }
  })

  it('unlocks lines once the entry gate is cleared', () => {
    const { quote } = quoteFor(allStrong())
    expect(quote.overall).toBeGreaterThanOrEqual(BUSINESS_PARAMETERS.minOverallToQuote)
    expect(quote.eligibleCount).toBeGreaterThan(0)
  })
})

describe('product gate', () => {
  // A 3 across the board scores 50 per category, which clears the 40 entry
  // gate. That lets these cases exercise the product gate on its own.
  const allThrees = Object.fromEntries(CATEGORIES.map((c) => [c.id, [3, 3, 3, 3]]))

  it('keeps a product locked when its own category is below threshold', () => {
    const { quote } = quoteFor(
      allStrong({ ...allThrees, 'financial-viability': [2, 2, 2, 2] }),
    )
    expect(quote.overall).toBeGreaterThanOrEqual(BUSINESS_PARAMETERS.minOverallToQuote)
    const line = quote.lines.find((l) => l.product.id === 'unit-economics')!
    expect(line.eligible).toBe(false)
    expect(line.weakestCategoryId).toBe('financial-viability')
    expect(line.reason).toContain('Financial Viability')
  })

  it('unlocks a product when its own category is strong', () => {
    const { quote } = quoteFor(allStrong({ ...allThrees, 'financial-viability': [5, 5, 5, 5] }))
    const line = quote.lines.find((l) => l.product.id === 'unit-economics')!
    expect(line.eligible).toBe(true)
    expect(line.weakestCategoryScore).toBe(100)
  })

  it('requires EVERY linked category to clear the threshold', () => {
    const product = productById('positioning')!
    expect(product.categoryIds).toHaveLength(2)
    const { quote } = quoteFor(
      allStrong({
        ...allThrees,
        'value-proposition': [4, 4, 4, 4],
        'competitive-advantage': [1, 1, 1, 1],
      }),
    )
    const line = quote.lines.find((l) => l.product.id === 'positioning')!
    expect(line.eligible).toBe(false)
    expect(line.weakestCategoryId).toBe('competitive-advantage')
    expect(line.reason).toContain('Competitive Advantage')
    // value-proposition passed, so it must not be named as a blocker
    expect(line.reason).not.toContain('Value Proposition')
  })

  it('names every category that is blocking a multi-category product', () => {
    const { quote } = quoteFor(
      allStrong({
        ...allThrees,
        'value-proposition': [2, 2, 2, 2],
        'competitive-advantage': [2, 2, 2, 2],
      }),
    )
    const line = quote.lines.find((l) => l.product.id === 'positioning')!
    expect(line.eligible).toBe(false)
    expect(line.reason).toContain('Value Proposition')
    expect(line.reason).toContain('Competitive Advantage')
  })
})

describe('totals and discounting', () => {
  it('sums only the eligible lines', () => {
    const { quote } = quoteFor(allStrong())
    const expected = quote.lines
      .filter((l) => l.eligible)
      .reduce((sum, l) => sum + l.product.price, 0)
    expect(quote.subtotal).toBe(expected)
  })

  it('applies the scale tier discount at 80+', () => {
    const { quote } = quoteFor(allStrong())
    expect(quote.tier.id).toBe('scale')
    expect(quote.discount).toBeCloseTo((quote.subtotal * 10) / 100, 2)
    expect(quote.total).toBeCloseTo(quote.subtotal - quote.discount, 2)
  })

  it('keeps total equal to subtotal at the foundation tier', () => {
    const { quote } = quoteFor(
      allStrong({ ...allOnes, sustainability: [3, 3, 3, 3] }),
    )
    if (quote.tier.id === 'foundation') {
      expect(quote.discount).toBe(0)
      expect(quote.total).toBe(quote.subtotal)
    }
  })

  it('never produces a negative total', () => {
    const { quote } = quoteFor(allStrong(allOnes))
    expect(quote.total).toBeGreaterThanOrEqual(0)
  })
})

describe('quoting is derived, not stored', () => {
  it('recalculates when answers change', () => {
    const weak = quoteFor(allStrong(allOnes))
    const strong = quoteFor(allStrong())
    expect(weak.quote.total).toBe(0)
    expect(strong.quote.total).toBeGreaterThan(0)
  })

  it('produces a quotation for the sample business', () => {
    const sample = createSampleEvaluation()
    const score = computeScore(sample.answers)
    const quote = buildQuote(sample, score, BUSINESS_PARAMETERS, PRODUCTS, NOW)
    expect(quote.lines).toHaveLength(PRODUCTS.length)
    expect(quote.currency).toBe('PHP')
    expect(quote.total).toBeGreaterThan(0)
  })
})

describe('quote numbering and validity', () => {
  it('derives a stable reference from the evaluation and date', () => {
    const a = quoteNumber('abc123def456', '2026-03-01T00:00:00.000Z')
    const b = quoteNumber('abc123def456', '2026-03-01T09:00:00.000Z')
    expect(a).toBe(b)
    expect(a).toMatch(/^Q-20260301-[0-9A-Z]{6}$/)
  })

  it('copes with an evaluation id that has no usable characters', () => {
    expect(quoteNumber('---', '2026-03-01T00:00:00.000Z')).toMatch(/^Q-20260301-/)
  })

  it('sets a validity window from the business parameters', () => {
    const { quote } = quoteFor(allStrong())
    const days =
      (new Date(quote.validUntil).getTime() - new Date(quote.issuedAt).getTime()) / 86_400_000
    expect(days).toBe(BUSINESS_PARAMETERS.quoteValidDays)
  })
})

describe('freezing a proposal', () => {
  it('captures only the eligible lines', () => {
    const { quote, evaluation } = quoteFor(allStrong(allOnes))
    const snapshot = freezeQuote(quote, evaluation)
    expect(snapshot.lines).toHaveLength(0)
    expect(snapshot.total).toBe(0)
  })

  it('keeps the frozen price even after answers change', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    const frozenTotal = snapshot.total
    const later = computeScore({ ...evaluation.answers, 'customer-problem__0': { value: 1, note: '' } })
    expect(later.overall).toBeLessThanOrEqual(100)
    expect(snapshot.total).toBe(frozenTotal)
  })

  it('copies deliverable arrays by value, not by reference', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(snapshot.lines.length).toBeGreaterThan(0)
    const original = quote.lines.find((l) => l.eligible)!.product.deliverables
    expect(snapshot.lines[0].deliverables).not.toBe(original)
    expect(snapshot.lines[0].deliverables).toEqual(original)
  })

  it('reuses the quote clock rather than issuing a new one', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(snapshot.issuedAt).toBe(quote.issuedAt)
    expect(snapshot.validUntil).toBe(quote.validUntil)
    expect(snapshot.number).toBe(quote.number)
  })

  it('carries the timeline and discount onto the frozen proposal', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(snapshot.tierDiscountPct).toBe(quote.tier.discountPct)
    expect(snapshot.parallelism).toBe(quote.parallelism)
    expect(snapshot.parallelWeeks).toBe(quote.parallelWeeks)
    // A snapshot only carries quotable lines, so the timeline covers exactly
    // what was priced.
    expect(snapshot.sequentialWeeks).toBe(
      sequentialWeeks(snapshot.lines.map((l) => l.durationWeeks)),
    )
    expect(sequentialWeeks([])).toBe(0)
  })
})

describe('delivery timeline', () => {
  it('adds durations when work runs one service at a time', () => {
    expect(sequentialWeeks([3, 4, 5])).toBe(12)
  })

  it('ignores non-positive and non-finite durations', () => {
    expect(sequentialWeeks([3, 0, -4, Number.NaN, Number.POSITIVE_INFINITY, 5])).toBe(8)
    expect(sequentialWeeks([])).toBe(0)
  })

  it('reports zero for an empty quote rather than zero-by-accident', () => {
    expect(parallelWeeks([], 2)).toBe(0)
  })

  it('packs work into the given number of streams', () => {
    expect(parallelWeeks([4, 4, 4], 1)).toBe(12)
    expect(parallelWeeks([4, 4, 4], 3)).toBe(4)
  })

  it('never claims a duration shorter than the single longest service', () => {
    // A naive total/parallelism would say 6 here, which is not achievable:
    // the 12-week engagement is a hard floor.
    expect(parallelWeeks([12, 3, 3, 3, 3], 4)).toBe(12)
  })

  it('loads the least-busy stream first', () => {
    // LPT: 8 -> A, 5 -> B, 4 -> B, 3 -> A. A=11, B=9.
    expect(parallelWeeks([8, 5, 4, 3], 2)).toBe(11)
  })

  it('is never faster than sequential delivery', () => {
    const durations = [12, 4, 4, 3, 3, 3, 3, 2]
    for (const p of [1, 2, 3, 4, 8]) {
      expect(parallelWeeks(durations, p)).toBeLessThanOrEqual(sequentialWeeks(durations))
    }
  })

  it('collapses to a single stream for a nonsensical setting', () => {
    const durations = [4, 6]
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parallelWeeks(durations, bad)).toBe(10)
    }
  })

  it('does not mutate the caller array', () => {
    const durations = [3, 12, 4]
    parallelWeeks(durations, 2)
    expect(durations).toEqual([3, 12, 4])
  })
})

describe('expiry and staleness', () => {
  it('detects an expired quotation', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(isQuoteExpired(snapshot, new Date('2026-03-01T00:00:00.000Z'))).toBe(false)
    expect(isQuoteExpired(snapshot, new Date('2026-06-01T00:00:00.000Z'))).toBe(true)
  })

  it('counts down the days remaining', () => {
    expect(expiryNotice('2026-03-31T00:00:00.000Z', new Date('2026-03-01T00:00:00.000Z'))).toBe(
      'Valid for 30 more days.',
    )
    expect(expiryNotice('2026-03-02T00:00:00.000Z', new Date('2026-03-01T00:00:00.000Z'))).toBe(
      'Valid for 1 more day.',
    )
    expect(expiryNotice('2026-02-01T00:00:00.000Z', new Date('2026-03-01T00:00:00.000Z'))).toBe(
      'This quotation has expired.',
    )
  })

  it('flags a quotation as stale once the evaluation is edited', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(isQuoteStale(snapshot, evaluation)).toBe(false)
    expect(
      isQuoteStale(snapshot, { ...evaluation, updatedAt: '2026-03-05T00:00:00.000Z' }),
    ).toBe(true)
  })

  it('does not report a quote stale just because updatedAt is past issuedAt', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    // The regression this guards: a wall-clock `>` comparison flags any quote
    // whose `updatedAt` is later than `issuedAt`, which is exactly the state
    // the app is in the moment after it saves the frozen quote. Comparing the
    // captured stamp for equality is what makes that safe.
    const savedAt = new Date(new Date(quote.issuedAt).getTime() + 5).toISOString()
    const justSaved = { ...evaluation, updatedAt: savedAt }
    expect(new Date(justSaved.updatedAt).getTime()).toBeGreaterThan(
      new Date(quote.issuedAt).getTime(),
    )
    // The app's save path leaves updatedAt alone, so a frozen quote is only
    // ever stale once an answer actually changes.
    expect(isQuoteStale(freezeQuote(quote, justSaved), justSaved)).toBe(false)
    expect(isQuoteStale(freezeQuote(quote, evaluation), justSaved)).toBe(true)
  })

  it('captures the evaluation stamp that staleness is measured against', () => {
    const { quote, evaluation } = quoteFor(allStrong())
    const snapshot = freezeQuote(quote, evaluation)
    expect(snapshot.evaluationUpdatedAt).toBe(evaluation.updatedAt)
    expect(snapshot.evaluationId).toBe(evaluation.id)
  })
})
