import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { CATEGORIES } from '../lib/questions'
import { CLASSIFICATIONS } from '../lib/scoring'
import { PRODUCTS } from '../lib/catalog'
import { formatMoney } from '../lib/money'

beforeEach(() => {
  window.localStorage.clear()
})

describe('application flow', () => {
  it('renders the welcome screen with the four primary actions', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /Test your business idea/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Evaluation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue Saved Evaluation' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Load Sample Idea' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Presentation Mode' })).toBeDisabled()
  })

  it('shows validation errors when starting with an empty profile', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start Evaluation' }))

    await user.click(screen.getByRole('button', { name: 'Continue to Evaluation' }))

    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(screen.getByText(/Business name is required/i)).toBeInTheDocument()
  })

  it('validates that startup cost must be numeric', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start Evaluation' }))

    await user.type(screen.getByLabelText(/Estimated startup cost/i), 'a lot')
    await user.click(screen.getByRole('button', { name: 'Continue to Evaluation' }))
    expect(screen.getByText(/must be a number/i)).toBeInTheDocument()
  })

  it('navigates from a filled profile into the evaluation wizard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start Evaluation' }))

    await fillProfile(user)

    await user.click(screen.getByRole('button', { name: 'Continue to Evaluation' }))
    expect(screen.getByRole('heading', { name: 'Customer Problem' })).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 10/)).toBeInTheDocument()
  })

  it('loads the sample idea straight into an evaluation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))

    expect(screen.getByRole('heading', { name: 'FreshNest Meal Kits' })).toBeInTheDocument()
    // The sample is calibrated to the 60-79 band so the quotation shows a
    // discount; see `sample.test.ts`.
    expect(screen.getByText(CLASSIFICATIONS[2].name)).toBeInTheDocument()
  })

  it('opens presentation mode from the results dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
    await user.click(screen.getByRole('button', { name: 'Presentation Mode' }))

    expect(screen.getByText('Business name and vision')).toBeInTheDocument()
    expect(screen.getByText(/Slide 1 of 12/)).toBeInTheDocument()
  })

  it('opens a quotation from the results dashboard and freezes a proposal', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))

    await user.click(screen.getByRole('button', { name: 'View quotation' }))
    expect(screen.getByText('Quotation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Customer Discovery Sprint' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Freeze into a proposal' }))

    expect(screen.getByText('Quotation number')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unfreeze and recalculate' })).toBeInTheDocument()
    // Regression: saving the snapshot must not read as an edit to the answers,
    // which would stamp every freshly issued proposal as already stale.
    expect(
      screen.queryByText(/Your answers have changed since this quotation was issued/),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/This quotation expired/)).not.toBeInTheDocument()
  })

  it('marks a frozen quotation stale only after the answers change', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
    await user.click(screen.getByRole('button', { name: 'View quotation' }))
    await user.click(screen.getByRole('button', { name: 'Freeze into a proposal' }))
    expect(
      screen.queryByText(/Your answers have changed since this quotation was issued/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to results' }))
    await user.click(screen.getByRole('button', { name: 'Edit answers' }))
    // Re-answer question 1 of the first category; that is a real answer edit,
    // so the frozen proposal should now be flagged. Pick a rating that is not
    // already selected, otherwise the radio never fires a change.
    const ratings = screen.getAllByRole('radio', { name: /Question 1 rating:/ })
    const unchecked = ratings.find((r) => !(r as HTMLInputElement).checked)
    await user.click(unchecked!)

    // Jump to the final step so the results dashboard is reachable again.
    const last = CATEGORIES[CATEGORIES.length - 1]
    await user.click(screen.getByRole('button', { name: new RegExp(`${CATEGORIES.length} ${last.label}`) }))
    await user.click(screen.getByRole('button', { name: 'View results' }))

    await user.click(screen.getByRole('button', { name: 'View quotation' }))
    expect(
      screen.getByText(/Your answers have changed since this quotation was issued/),
    ).toBeInTheDocument()
  })

  it('keeps a frozen quotation across a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
    await user.click(screen.getByRole('button', { name: 'View quotation' }))
    await user.click(screen.getByRole('button', { name: 'Freeze into a proposal' }))
    const frozenNumber = screen.getAllByText(/^Q-\d{8}-[0-9A-Z]{6}$/)[0].textContent
    unmount()

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Continue Saved Evaluation' }))
    await user.click(screen.getByRole('button', { name: 'Select' }))
    await user.click(screen.getByRole('button', { name: 'View quotation' }))

    expect(screen.getByText('Quotation number')).toBeInTheDocument()
    expect(screen.getAllByText(frozenNumber!).length).toBeGreaterThan(0)
  })

  describe('editable rate card', () => {
    it('opens the rate card from the navigation', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /rate card/i }))
      expect(screen.getByRole('heading', { name: /rate card/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Save rate card$/i })).toBeInTheDocument()
    })

    it('prices a quotation with the edited rate card', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /rate card/i }))
      await user.click(screen.getByRole('button', { name: new RegExp(PRODUCTS[0].name, 'i') }))

      const price = screen
        .getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })
        .querySelector('input[type="number"]') as HTMLInputElement
      await user.clear(price)
      await user.type(price, '120000')
      await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

      await user.click(screen.getByRole('button', { name: /^Home$/ }))
      await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
      await user.click(screen.getByRole('button', { name: 'View quotation' }))
      expect(screen.getAllByText(formatMoney(120000)).length).toBeGreaterThan(0)
    })

    it('keeps a customised rate card across a reload', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<App />)
      await user.click(screen.getByRole('button', { name: /rate card/i }))
      await user.click(screen.getByRole('button', { name: new RegExp(PRODUCTS[0].name, 'i') }))
      const price = screen
        .getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })
        .querySelector('input[type="number"]') as HTMLInputElement
      await user.clear(price)
      await user.type(price, '120000')
      await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))
      unmount()

      render(<App />)
      await user.click(screen.getByRole('button', { name: /rate card/i }))
      await user.click(screen.getByRole('button', { name: new RegExp(PRODUCTS[0].name, 'i') }))
      const reloaded = screen
        .getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })
        .querySelector('input[type="number"]') as HTMLInputElement
      expect(reloaded).toHaveValue(120000)
    })

    it('does not retroactively change a frozen proposal', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
      await user.click(screen.getByRole('button', { name: 'View quotation' }))
      await user.click(screen.getByRole('button', { name: 'Freeze into a proposal' }))
      const frozenTotal = document.querySelector('.quote-total-grand')?.textContent

      await user.click(screen.getByRole('button', { name: /rate card/i }))
      await user.click(screen.getByRole('button', { name: new RegExp(PRODUCTS[0].name, 'i') }))
      const price = screen
        .getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })
        .querySelector('input[type="number"]') as HTMLInputElement
      await user.clear(price)
      await user.type(price, '120000')
      await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

      // The rate card is edited while the proposal is frozen; the issued
      // figures must not move underneath the client.
      await user.click(screen.getByRole('button', { name: /^Home$/ }))
      await user.click(screen.getByRole('button', { name: 'Continue Saved Evaluation' }))
      // Straight back to the quotation: the manager lists the evaluation, and
      // the quotation is reachable from the results dashboard it was on.
      await user.click(screen.getByRole('button', { name: /Open/i }))
      await user.click(screen.getByRole('button', { name: 'View quotation' }))
      expect(document.querySelector('.quote-total-grand')?.textContent).toBe(frozenTotal)
    })

    it('resets the rate card to the shipped catalog', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /rate card/i }))
      await user.click(screen.getByRole('button', { name: new RegExp(PRODUCTS[0].name, 'i') }))
      const price = screen
        .getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') })
        .querySelector('input[type="number"]') as HTMLInputElement
      await user.clear(price)
      await user.type(price, '120000')
      await user.click(screen.getByRole('button', { name: /^Save rate card$/i }))

      await user.click(screen.getByRole('button', { name: /reset to defaults/i }))

      // The editor row stays open across a reset, so do not toggle it again.
      const after = within(
        screen.getByRole('region', { name: new RegExp(PRODUCTS[0].name, 'i') }),
      ).getByLabelText(/list price/i)
      expect(after).toHaveValue(PRODUCTS[0].price)
    })
  })
})

async function fillProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Business name/i), 'Fresh Coffee Co')
  await user.type(
    screen.getByLabelText(/Business description/i),
    'A subscription coffee delivery service focused on paper-free, locally roasted beans.',
  )
  await user.type(
    screen.getByLabelText(/Problem being solved/i),
    'Coffee drinkers waste time and plastic on weak supermarket coffee every week.',
  )
  await user.type(
    screen.getByLabelText(/Proposed product or service/i),
    'Monthly bean boxes with a reusable brewer kit.',
  )
  await user.type(
    screen.getByLabelText(/Target customers/i),
    'Home coffee enthusiasts aged 25-45 in the metro area.',
  )
  await user.type(screen.getByLabelText(/Geographic market/i), 'Metro area')
  await user.type(
    screen.getByLabelText(/Revenue model/i),
    'Flat monthly subscription fee of 34 dollars.',
  )
  await user.type(screen.getByLabelText(/Estimated startup cost/i), '8000')
  await user.type(
    screen.getByLabelText(/Short-term objective/i),
    'Reach 200 active subscribers within 12 months.',
  )
  await user.type(
    screen.getByLabelText(/Long-term vision/i),
    'Become the region\u2019s most loved local coffee subscription.',
  )
}
