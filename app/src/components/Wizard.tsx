import { useState } from 'react'
import type { Answers, Evaluation } from '../types'
import { CATEGORIES } from '../lib/questions'
import { answerKey, answerLabel, encouragementFor } from '../lib/scoring'

interface Props {
  evaluation: Evaluation
  onAnswersChange: (answers: Answers) => void
  onBack: () => void
  onFinish: () => void
}

const SCALE_VALUES = [1, 2, 3, 4, 5]

export function Wizard({ evaluation, onAnswersChange, onBack, onFinish }: Props) {
  const [step, setStep] = useState(0)
  const [attemptedFinish, setAttemptedFinish] = useState(false)

  const categories = CATEGORIES
  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0)
  const answeredCount = Object.values(evaluation.answers).filter(
    (a) => typeof a.value === 'number',
  ).length
  const isLast = step === categories.length - 1
  const category = categories[step]

  function setAnswer(questionIndex: number, value: number | null): void {
    const key = answerKey(category.id, questionIndex)
    const previous = evaluation.answers[key]
    onAnswersChange({
      ...evaluation.answers,
      [key]: { value, note: previous?.note ?? '' },
    })
  }

  function setNote(questionIndex: number, note: string): void {
    const key = answerKey(category.id, questionIndex)
    const previous = evaluation.answers[key]
    onAnswersChange({
      ...evaluation.answers,
      [key]: { value: previous?.value ?? null, note },
    })
  }

  function goNext(): void {
    if (isLast) {
      setAttemptedFinish(true)
      if (answeredCount >= 3) {
        onFinish()
      }
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setStep((s) => s + 1)
  }

  function goPrevious(): void {
    setAttemptedFinish(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setStep((s) => Math.max(0, s - 1))
  }

  const progress = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100)
  const unableToFinish = attemptedFinish && answeredCount < 3

  return (
    <section aria-labelledby="wizard-title">
      <div className="page-head">
        <div>
          <p className="kicker">
            Step {step + 1} of {categories.length}
          </p>
          <h1 id="wizard-title">{category.label}</h1>
          <p className="muted">{category.description}</p>
        </div>
        <div className="wizard-meta">
          <div
            className="progress-ring"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Evaluation completion"
          >
            {progress}%
          </div>
          <p className="hint">
            Answered {answeredCount} of {totalQuestions} questions
          </p>
        </div>
      </div>

      <div className="step-nav" aria-label="Evaluation steps">
        {categories.map((c, i) => (
          <button
            type="button"
            key={c.id}
            className={'step-pill' + (i === step ? ' is-active' : '')}
            onClick={() => setStep(i)}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="step-pill-num">{i + 1}</span> {c.label}
          </button>
        ))}
      </div>

      <div className="card wizard-card" aria-live="off">
        <h2 className="sr-only">Questions for {category.label}</h2>
        {category.questions.map((q, idx) => {
          const key = answerKey(category.id, idx)
          const value = evaluation.answers[key]?.value ?? null
          const note = evaluation.answers[key]?.note ?? ''
          const groupId = 'q-' + category.id + '-' + idx
          return (
            <fieldset key={key} className="question-block">
              <legend className="question-text">
                <span className="question-number">{idx + 1}.</span> {q.text}
              </legend>
              <p className="q-why">
                <span className="q-why-label">Why this matters: </span>
                {q.why}
              </p>

              <div className="scale" role="radiogroup" aria-label={'Rating for question ' + (idx + 1)}>
                {SCALE_VALUES.map((v) => {
                  const radioId = groupId + '-v' + v
                  const checked = value === v
                  return (
                    <label
                      key={radioId}
                      className={'scale-option' + (checked ? ' is-checked' : '')}
                    >
                      <input
                        type="radio"
                        name={groupId}
                        value={v}
                        checked={checked}
                        onChange={() => setAnswer(idx, v)}
                        aria-label={
                          'Question ' + (idx + 1) + ' rating: ' + answerLabel(v) + ' (' + v + ')'
                        }
                      />
                      <span className="scale-num">{v}</span>
                      <span className="scale-label">{answerLabel(v)}</span>
                    </label>
                  )
                })}
              </div>

              <p className="q-feedback" aria-live="polite" role="status">
                {encouragementFor(value, q)}
              </p>

              <label className="q-note" htmlFor={groupId + '-note'}>
                Optional note
              </label>
              <textarea
                id={groupId + '-note'}
                value={note}
                onChange={(e) => setNote(idx, e.target.value)}
                rows={2}
                placeholder="Add anything that explains your answer."
              />
            </fieldset>
          )
        })}
      </div>

      {unableToFinish ? (
        <p className="form-summary-error" role="alert">
          Answer at least three questions before viewing results. Unanswered questions are treated
          honestly as zeroes and will lower your score.
        </p>
      ) : null}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={goPrevious} disabled={step === 0}>
          Previous
        </button>
        {isLast ? (
          <button type="button" className="primary" onClick={goNext}>
            View results
          </button>
        ) : (
          <button type="button" className="primary" onClick={goNext}>
            Next
          </button>
        )}
        <button type="button" className="ghost" onClick={onBack}>
          Back to profile
        </button>
      </div>
    </section>
  )
}