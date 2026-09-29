import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuoteView } from '../components/QuoteView'
import { BUSINESS_PARAMETERS, PRODUCTS } from '../lib/catalog'
import { formatMoney } from '../lib/money'
import { CATEGORIES } from '../lib/questions'
import { computeScore } from '../lib/scoring'
import { buildQuote, freezeQuote } from '../lib/quote'
import { allStrong, makeEvaluation, withAnswers } from '../test/fixtures'
import { createSampleEvaluation } from '../lib/sample'
import type { Evaluation } from '../types'

function renderQuote(evaluation: Evaluation, params = BUSINESS_PARAMETERS, catalog = PRODUCTS) {
  const handlers = {
    onFreeze: vi.fn(),
    onClearFreeze: vi.fn(),
    onBack: vi.fn(),
    onPrint: vi.fn(),
    onExportCsv: vi.fn(),
    onExportJson: vi.fn(),
  }
  const utils = render(
    <QuoteView
      evaluation={evaluation}
      params={params}
      catalog={catalog}
      {...handlers}
    />,
  )
  return { ...handlers, ...utils }
}

const allOnes = Object.fromEntries(CATEGORIES.map((c) => [c.id, [1, 1, 1, 1]]))

describe('quote view', () => {
  it('shows a live quote priced in pesos with a freeze action', () => {
    renderQuote(createSampleEvaluation())
    expect(
      screen.getByRole('heading', { name: 'FreshNest Meal Kits' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Quotation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Freeze into a proposal' })).toBeInTheDocument()
  })

  it('lists every product so nothing is hidden behind the gate', () => {
    renderQuote(withAnswers(makeEvaluation(), allStrong(allOnes)))
    for (const product of PRODUCTS) {
      expect(screen.getByRole('heading', { name: product.name })).toBeInTheDocument()
    }
  })

  it('keeps locked lines visible and states the unlock condition', () => {
    renderQuote(withAnswers(makeEvaluation(), allStrong(allOnes)))
    const locked = document.querySelectorAll('.quote-line-locked')
    expect(locked.length).toBe(PRODUCTS.length)
    expect(screen.getAllByText(/Unlocks at an overall score of 40/).length).toBe(
      PRODUCTS.length,
    )
  })

  it('marks locked lines as disabled for assistive technology', () => {
    renderQuote(withAnswers(makeEvaluation(), allStrong(allOnes)))
    const states = screen.getAllByText(/Not yet available/)
    expect(states.length).toBe(PRODUCTS.length)
    for (const el of states) {
      expect(el).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('shows available lines and a zero total when nothing clears the gate', () => {
    renderQuote(withAnswers(makeEvaluation(), allStrong(allOnes)))
    expect(screen.getAllByText(/Not yet available/).length).toBe(PRODUCTS.length)
    expect(screen.getAllByText('₱0').length).toBeGreaterThan(0)
  })

  it('explains the locked count as a roadmap rather than a rejection', () => {
    renderQuote(withAnswers(makeEvaluation(), allStrong(allOnes)))
    expect(screen.getByText(/roadmap, not a rejection/)).toBeInTheDocument()
  })

  it('prices available services once the gates are cleared', () => {
    renderQuote(createSampleEvaluation())
    expect(screen.getAllByText('Available now').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Freeze into a proposal' })).toBeInTheDocument()
  })

  it('carries a disclaimer that this is an estimate, not a binding offer', () => {
    renderQuote(createSampleEvaluation())
    expect(screen.getByText(/estimate, not a binding offer/i)).toBeInTheDocument()
  })

  describe('discount presentation', () => {
    it('strikes through the list price once a tier discount applies', () => {
      renderQuote(createSampleEvaluation())
      // The sample sits on Growth (5%), so the reduction must be visible.
      expect(screen.getByText('List price')).toBeInTheDocument()
      expect(screen.getByText('Growth tier discount (5%)')).toBeInTheDocument()
      expect(screen.getByText('Total (after 5% off)')).toBeInTheDocument()
      // The struck amount uses a real <s> element, so assistive tech and
      // print styles both convey the reduction rather than it being colour-only.
      const struck = document.querySelector('.quote-list-price s')
      expect(struck).not.toBeNull()
      expect(struck?.textContent).toBe(formatMoney(315000))
    })

    it('shows no struck price or discount when the tier grants 0%', () => {
      const params = {
        ...BUSINESS_PARAMETERS,
        tiers: BUSINESS_PARAMETERS.tiers.map((t) =>
          t.id === 'foundation' ? { ...t, minOverall: 0 } : { ...t, minOverall: 999 },
        ),
      }
      renderQuote(createSampleEvaluation(), params)
      expect(screen.queryByText('List price')).not.toBeInTheDocument()
      expect(screen.queryByText(/tier discount/)).not.toBeInTheDocument()
      expect(screen.getByText('Quotation total')).toBeInTheDocument()
      expect(document.querySelector('.quote-list-price s')).toBeNull()
    })
  })

  describe('delivery timeline', () => {
    it('states the parallel assumption rather than only the total', () => {
      renderQuote(createSampleEvaluation())
      expect(screen.getByText(/at a time/i)).toBeInTheDocument()
    })

    it('shows a shorter parallel duration than the sequential one', () => {
      const evaluation = createSampleEvaluation()
      const score = computeScore(evaluation.answers)
      const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS)
      renderQuote(evaluation)
      expect(quote.parallelWeeks).toBeLessThan(quote.sequentialWeeks)
      expect(screen.getByText(new RegExp(`${quote.parallelWeeks} weeks`))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(`${quote.sequentialWeeks} weeks`))).toBeInTheDocument()
    })
  })

  it('honours a custom rate card instead of the shipped catalog', () => {
    const catalog = PRODUCTS.map((p, i) =>
      i === 0 ? { ...p, price: 99999, name: 'Renamed Service' } : p,
    )
    const evaluation = createSampleEvaluation()
    const score = computeScore(evaluation.answers)
    renderQuote(evaluation, BUSINESS_PARAMETERS, catalog)
    const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, catalog)
    expect(screen.getByText('Renamed Service')).toBeInTheDocument()
    expect(screen.queryByText('Customer Discovery Workshop')).not.toBeInTheDocument()
    expect(quote.subtotal).not.toBe(buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS).subtotal)
  })

  it('freezes into a numbered proposal when asked', async () => {
    const user = userEvent.setup()
    const evaluation = createSampleEvaluation()
    const { onFreeze } = renderQuote(evaluation)
    await user.click(screen.getByRole('button', { name: 'Freeze into a proposal' }))
    expect(onFreeze).toHaveBeenCalledTimes(1)
    const snapshot = onFreeze.mock.calls[0][0]
    const score = computeScore(evaluation.answers)
    const expected = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS)
    expect(snapshot.number).toBe(expected.number)
    expect(snapshot.total).toBe(expected.total)
  })

  it('exports a CSV of the live quote', async () => {
    const user = userEvent.setup()
    const { onExportCsv } = renderQuote(createSampleEvaluation())
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(onExportCsv).toHaveBeenCalledTimes(1)
    expect(onExportCsv.mock.calls[0][0].lines).toHaveLength(PRODUCTS.length)
  })

  it('shows the frozen panel instead of the live quote once frozen', () => {
    const evaluation = createSampleEvaluation()
    const score = computeScore(evaluation.answers)
    const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS)
    const frozen: Evaluation = {
      ...evaluation,
      quoteSnapshot: freezeQuote(quote, evaluation),
    }
    renderQuote(frozen)
    expect(screen.getByText('Quotation number')).toBeInTheDocument()
    expect(screen.getAllByText(quote.number).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Freeze into a proposal' })).not.toBeInTheDocument()
  })

  it('warns when the answers changed after the quotation was issued', () => {
    const evaluation = createSampleEvaluation()
    const score = computeScore(evaluation.answers)
    const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS)
    const frozen: Evaluation = {
      ...evaluation,
      updatedAt: '2099-01-01T00:00:00.000Z',
      quoteSnapshot: freezeQuote(quote, evaluation),
    }
    renderQuote(frozen)
    expect(screen.getByText(/Your answers have changed since this quotation was issued/)).toBeInTheDocument()
  })

  it('clears a frozen quotation on request', async () => {
    const user = userEvent.setup()
    const evaluation = createSampleEvaluation()
    const score = computeScore(evaluation.answers)
    const quote = buildQuote(evaluation, score, BUSINESS_PARAMETERS, PRODUCTS)
    const frozen: Evaluation = {
      ...evaluation,
      quoteSnapshot: freezeQuote(quote, evaluation),
    }
    const { onClearFreeze } = renderQuote(frozen)
    await user.click(screen.getByRole('button', { name: 'Unfreeze and recalculate' }))
    expect(onClearFreeze).toHaveBeenCalledTimes(1)
  })

  it('returns to the results dashboard', async () => {
    const user = userEvent.setup()
    const { onBack } = renderQuote(createSampleEvaluation())
    await user.click(screen.getByRole('button', { name: 'Back to results' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('sits inside the print container so Save as PDF captures it', () => {
    const { container } = renderQuote(createSampleEvaluation())
    expect(within(container).getAllByRole('button', { name: 'Save as PDF' }).length).toBeGreaterThan(0)
    expect(container.querySelector('#report-root')).not.toBeNull()
  })
})
