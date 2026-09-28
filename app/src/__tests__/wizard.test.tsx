import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Answers, Evaluation } from '../types'
import { Wizard } from '../components/Wizard'
import { makeEvaluation } from '../test/fixtures'

function Harness({ onFinish }: { onFinish: () => void }) {
  const [evaluation, setEvaluation] = useState<Evaluation>(makeEvaluation())
  return (
    <Wizard
      evaluation={evaluation}
      onAnswersChange={(answers: Answers) =>
        setEvaluation((prev) => ({ ...prev, answers }))
      }
      onBack={() => undefined}
      onFinish={onFinish}
    />
  )
}

describe('wizard navigation', () => {
  it('renders ten category steps and starts on the first', () => {
    render(<Harness onFinish={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Customer Problem' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^[0-9]+ / })).toHaveLength(10)
    expect(screen.getByText(/Step 1 of 10/)).toBeInTheDocument()
  })

  it('moves between steps with Next and Previous', async () => {
    const user = userEvent.setup()
    render(<Harness onFinish={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Market Opportunity' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('heading', { name: 'Customer Problem' })).toBeInTheDocument()
  })

  it('preserves answers and notes when navigating away and back', async () => {
    const user = userEvent.setup()
    render(<Harness onFinish={() => undefined} />)

    await user.click(
      screen.getByRole('radio', { name: 'Question 1 rating: Very strong (5)' }),
    )
    await user.type(
      screen.getAllByLabelText(/Optional note/)[0],
      'Confirmed by 12 interviews',
    )

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Market Opportunity' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(
      screen.getByRole('radio', { name: 'Question 1 rating: Very strong (5)' }),
    ).toBeChecked()
    expect(screen.getAllByLabelText(/Optional note/)[0]).toHaveValue(
      'Confirmed by 12 interviews',
    )
  })

  it('blocks finishing until at least three questions are answered', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Harness onFinish={onFinish} />)

    await user.click(screen.getByRole('button', { name: /10 Founder Readiness/ }))
    expect(screen.getByRole('button', { name: 'View results' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View results' }))
    expect(onFinish).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Answer at least three questions before viewing results/i),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', { name: 'Question 1 rating: Very strong (5)' }),
    )
    await user.click(
      screen.getByRole('radio', { name: 'Question 2 rating: Strong (4)' }),
    )
    await user.click(
      screen.getByRole('radio', { name: 'Question 3 rating: Partially established (3)' }),
    )
    await user.click(screen.getByRole('button', { name: 'View results' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('shows encouraging feedback for each rating', async () => {
    const user = userEvent.setup()
    render(<Harness onFinish={() => undefined} />)

    expect(screen.getAllByText(/Not answered yet/i)).toHaveLength(4)
    await user.click(
      screen.getByRole('radio', { name: 'Question 1 rating: Not yet established (1)' }),
    )
    expect(screen.getAllByText(/Not answered yet/i)).toHaveLength(3)
    expect(screen.getAllByText(/early stage, not a verdict/i)).toHaveLength(1)
  })
})