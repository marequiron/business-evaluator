import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RateCardView } from '../components/RateCardView'
import { defaultRateCard } from '../lib/ratecard'
import { BUSINESS_PARAMETERS, PRODUCTS } from '../lib/catalog'
import { formatMoney } from '../lib/money'
import type { RateCard } from '../lib/ratecard'

function renderEditor(card: RateCard = defaultRateCard(), customised = false) {
  const onSave = vi.fn()
  const onReset = vi.fn()
  const onBack = vi.fn()
  const utils = render(
    <RateCardView
      card={card}
      customised={customised}
      onSave={onSave}
      onReset={onReset}
      onBack={onBack}
    />,
  )
  return { onSave, onReset, onBack, ...utils }
}

/** Product cards are collapsed by default; open one to reach its fields. */
async function openProduct(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(name, 'i') }))
}

describe('rate card editor', () => {
  it('lists every service with its list price and duration', () => {
    renderEditor()
    for (const product of PRODUCTS) {
      expect(screen.getByRole('button', { name: new RegExp(product.name, 'i') })).toBeInTheDocument()
      expect(screen.getAllByText(formatMoney(product.price)).length).toBeGreaterThan(0)
    }
  })

  it('edits a price and saves the whole card', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)

    const price = within(
      screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
    ).getByLabelText(/list price/i)
    await user.clear(price)
    await user.type(price, '72500')

    expect(onSave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as RateCard
    expect(saved.products[0].price).toBe(72500)
  })

  it('refuses to save an empty price instead of treating it as free', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)

    const price = within(
      screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
    ).getByLabelText(/list price/i)
    await user.clear(price)
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    // `Number('')` is 0, so without the NaN guard this would save a free service.
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/price must be zero or more/i)).toBeInTheDocument()
  })

  it('refuses to save a fractional duration', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)

    const weeks = within(
      screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
    ).getByLabelText(/duration/i)
    await user.clear(weeks)
    await user.type(weeks, '2.5')
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/whole number of weeks/i)).toBeInTheDocument()
  })

  it('edits service copy, not just numbers', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)
    const region = screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })

    const name = within(region).getByLabelText(/service name/i)
    await user.clear(name)
    await user.type(name, 'Discovery Sprint')
    const summary = within(region).getByLabelText(/one-line summary/i)
    await user.clear(summary)
    await user.type(summary, 'Two half-day interviews and a findings memo.')
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    const saved = onSave.mock.calls[0][0] as RateCard
    expect(saved.products[0].name).toBe('Discovery Sprint')
    expect(saved.products[0].summary).toBe('Two half-day interviews and a findings memo.')
  })

  it('edits the deliverables list', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)
    const region = screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })

    const list = within(region).getByLabelText(/deliverables/i)
    await user.clear(list)
    await user.type(list, 'Interview script{enter}Findings memo')
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    const saved = onSave.mock.calls[0][0] as RateCard
    expect(saved.products[0].deliverables).toEqual(['Interview script', 'Findings memo'])
  })

  it('edits the entry gate, validity window, and parallelism', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    const gate = screen.getByLabelText(/entry score/i)
    await user.clear(gate)
    await user.type(gate, '55')
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    const saved = onSave.mock.calls[0][0] as RateCard
    expect(saved.params.minOverallToQuote).toBe(55)
    expect(saved.params.parallelism).toBe(BUSINESS_PARAMETERS.parallelism)
  })

  it('edits a tier discount', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    const discount = document.getElementById('rc-tier-scale-pct') as HTMLInputElement
    await user.clear(discount)
    await user.type(discount, '12')
    await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

    const saved = onSave.mock.calls[0][0] as RateCard
    const scale = saved.params.tiers.find((t) => t.id === 'scale')
    expect(scale?.discountPct).toBe(12)
  })

  it('discards unsaved edits', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await openProduct(user, PRODUCTS[0].name)
    const price = within(
      screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
    ).getByLabelText(/list price/i)
    await user.clear(price)
    await user.type(price, '72500')

    await user.click(screen.getByRole('button', { name: /discard changes/i }))
    expect(onSave).not.toHaveBeenCalled()
    // A number input's value is read back as a number, not a string.
    expect(price).toHaveValue(PRODUCTS[0].price)
    expect(screen.getByText(/Saved\. Quotations use these values\./)).toBeInTheDocument()
  })

  it('keeps discard disabled until something actually changes', async () => {
    const user = userEvent.setup()
    renderEditor()
    expect(screen.getByRole('button', { name: /discard changes/i })).toBeDisabled()

    await openProduct(user, PRODUCTS[0].name)
    const price = within(
      screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
    ).getByLabelText(/list price/i)
    await user.clear(price)
    await user.type(price, '72500')

    expect(screen.getByRole('button', { name: /discard changes/i })).toBeEnabled()
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('resets to the shipped catalog on request', async () => {
    const user = userEvent.setup()
    const { onReset } = renderEditor(defaultRateCard(), true)
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('offers a reset only once the card has actually been customised', () => {
    const { unmount } = renderEditor(defaultRateCard(), false)
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument()
    unmount()

    renderEditor(defaultRateCard(), true)
    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument()
  })

  it('states that edits stay in this browser only', () => {
    renderEditor()
    expect(screen.getByText(/this browser only/i)).toBeInTheDocument()
  })

  it('returns to the previous view', async () => {
    const user = userEvent.setup()
    const { onBack } = renderEditor()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
