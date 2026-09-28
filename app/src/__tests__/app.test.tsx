import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

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
    expect(screen.getByText(/Promising but needs improvement/i)).toBeInTheDocument()
  })

  it('opens presentation mode from the results dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load Sample Idea' }))
    await user.click(screen.getByRole('button', { name: 'Presentation Mode' }))

    expect(screen.getByText('Business name and vision')).toBeInTheDocument()
    expect(screen.getByText(/Slide 1 of 11/)).toBeInTheDocument()
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