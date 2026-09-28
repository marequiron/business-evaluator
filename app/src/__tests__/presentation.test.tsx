import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationMode } from '../components/PresentationMode'
import { computeScore, classify } from '../lib/scoring'
import { buildReport } from '../lib/recommendations'
import { createSampleEvaluation } from '../lib/sample'

function renderPresentation() {
  const evaluation = createSampleEvaluation()
  const score = computeScore(evaluation.answers)
  const report = buildReport(evaluation, score)
  const onExit = vi.fn()
  const utils = render(
    <PresentationMode evaluation={evaluation} score={score} report={report} onExit={onExit} />,
  )
  return { onExit, evaluation, score, report, ...utils }
}

describe('presentation mode', () => {
  it('renders the first slide with the business name and vision', () => {
    renderPresentation()
    expect(screen.getByText('Business name and vision')).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { name: 'FreshNest Meal Kits' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Slide 1 of 11/)).toBeInTheDocument()
  })

  it('moves forward and backward through the slides', async () => {
    const user = userEvent.setup()
    renderPresentation()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Customer problem')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('Business name and vision')).toBeInTheDocument()
  })

  it('shows risks, strengths, and the score slides as you advance', async () => {
    const user = userEvent.setup()
    const { score } = renderPresentation()

    await user.click(screen.getByRole('button', { name: 'Next' })) // problem
    await user.click(screen.getByRole('button', { name: 'Next' })) // solution
    await user.click(screen.getByRole('button', { name: 'Next' })) // market
    await user.click(screen.getByRole('button', { name: 'Next' })) // model
    expect(screen.getByText('Business model')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // score
    expect(screen.getByText(String(score.overall))).toBeInTheDocument()
    expect(screen.getByText(classify(score.overall).name)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // strengths
    expect(screen.getByText('Top strengths')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // risks
    expect(screen.getByText('Primary risks and mitigations')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // short-term
    expect(screen.getByText('Short-term plan')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // sustainability
    expect(screen.getByText('Long-term sustainability plan')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' })) // final
    expect(screen.getByText('Final recommendation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('calls onExit when the presenter leaves', async () => {
    const user = userEvent.setup()
    const { onExit } = renderPresentation()
    await user.click(screen.getByRole('button', { name: 'Exit Presentation' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('offers print and keyboard-friendly controls', () => {
    renderPresentation()
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })
})