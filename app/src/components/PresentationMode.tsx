import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Evaluation } from '../types'
import { classify } from '../lib/scoring'
import type { EvaluationScore } from '../lib/scoring'
import type { Report } from '../lib/recommendations'

interface Props {
  evaluation: Evaluation
  score: EvaluationScore
  report: Report
  onExit: () => void
}

interface Slide {
  title: string
  body: () => React.ReactNode
}

export function PresentationMode({ evaluation, score, report, onExit }: Props) {
  const [slide, setSlide] = useState(0)
  const classification = classify(score.overall)
  const p = evaluation.profile

  const slides: Slide[] = [
    {
      title: 'Business name and vision',
      body: () => (
        <div className="slide-body">
          <h2>{p.businessName || evaluation.name}</h2>
          <p className="slide-lead">Long-term vision</p>
          <p>{p.longTermVision || 'Not defined yet.'}</p>
          <p className="slide-lead">Short-term objective</p>
          <p>{p.shortTermObjective || 'Not defined yet.'}</p>
        </div>
      ),
    },
    {
      title: 'Customer problem',
      body: () => (
        <div className="slide-body">
          <p className="slide-lead">The problem this business removes</p>
          <p>{p.problemSolved || 'Not defined yet.'}</p>
        </div>
      ),
    },
    {
      title: 'Proposed solution',
      body: () => (
        <div className="slide-body">
          <p className="slide-lead">The product or service</p>
          <p>{p.productService || 'Not defined yet.'}</p>
          <p>{p.businessDescription || ''}</p>
        </div>
      ),
    },
    {
      title: 'Target market',
      body: () => (
        <div className="slide-body">
          <p className="slide-lead">Who we serve</p>
          <p>{p.targetCustomers || 'Not defined yet.'}</p>
          <p className="slide-lead">Where we operate</p>
          <p>{p.geographicMarket || 'Not defined yet.'}</p>
        </div>
      ),
    },
    {
      title: 'Business model',
      body: () => (
        <div className="slide-body">
          <p className="slide-lead">How we make money</p>
          <p>{p.revenueModel || 'Not defined yet.'}</p>
          <p className="slide-lead">Estimated startup cost</p>
          <p>{p.startupCost ? formatCost(p.startupCost) : 'Not provided yet.'}</p>
        </div>
      ),
    },
    {
      title: 'Evaluation score',
      body: () => (
        <div className="slide-body slide-score">
          <span className={'big-score tone-' + classification.tone}>{score.overall}</span>
          <h3>{classification.name}</h3>
          <p>{classification.description}</p>
          <p className="hint">
            Answered {score.totalAnswered} of {score.totalQuestions} questions.
          </p>
        </div>
      ),
    },
    {
      title: 'Top strengths',
      body: () => (
        <div className="slide-body">
          {report.strengths.length > 0 ? (
            <ol className="numbered-list big-list">
              {report.strengths.map((s) => (
                <li key={s.id}>
                  <strong>{s.label}</strong> — {Math.round(s.score100)}/100
                </li>
              ))}
            </ol>
          ) : (
            <p>Strengths are still forming; validation comes first.</p>
          )}
        </div>
      ),
    },
    {
      title: 'Primary risks and mitigations',
      body: () => (
        <div className="slide-body">
          {report.risks.length > 0 ? (
            <ul className="risk-list">
              {report.risks.map((r) => (
                <li key={r.id}>
                  <h3>{r.label}</h3>
                  <p className="risk-text">{r.risk}</p>
                  <p className="treatment-text">
                    <strong>Mitigation:</strong> {r.treatment}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No category is below the risk line right now.</p>
          )}
        </div>
      ),
    },
    {
      title: 'Short-term plan',
      body: () => (
        <div className="slide-body">
          <p className="slide-lead">Next 30 days</p>
          <ol className="numbered-list">
            {report.plan30.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
          <p className="slide-lead">Next 90 days</p>
          <ol className="numbered-list">
            {report.plan90.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      title: 'Long-term sustainability plan',
      body: () => (
        <div className="slide-body">
          <ol className="numbered-list big-list">
            {report.sustainabilityActions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
          <p className="slide-lead">Immediate next action</p>
          <p>{report.immediateAction}</p>
        </div>
      ),
    },
    {
      title: 'Final recommendation',
      body: () => (
        <div className="slide-body">
          <h3>{classification.name}</h3>
          <p>{classification.description}</p>
          <p className="slide-lead">One sentence to carry forward</p>
          <p>{report.nextStepGoal}</p>
          <p className="slide-lead">First step this week</p>
          <p>{report.immediateAction}</p>
        </div>
      ),
    },
  ]

  const total = slides.length
  const current = slides[slide]

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') goNext()
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') goPrevious()
  }

  function goNext(): void {
    setSlide((s) => Math.min(total - 1, s + 1))
  }

  function goPrevious(): void {
    setSlide((s) => Math.max(0, s - 1))
  }

  return (
    <section
      className="presentation"
      aria-labelledby="presentation-title"
      onKeyDown={handleKeyDown}
    >
      <div id="report-root" className="presentation-root">
        <header className="presentation-header">
          <p className="kicker">Business Evaluator — Presentation</p>
          <h1 id="presentation-title" className="sr-only">
            {p.businessName || evaluation.name}
          </h1>
          <span className="slide-counter" aria-live="polite">
            Slide {slide + 1} of {total}
          </span>
        </header>

        <div className="slide-content" aria-live="off">
          <h2 className="slide-heading">{current.title}</h2>
          {current.body()}
        </div>

        <footer className="presentation-footer">
          <button type="button" className="secondary" onClick={goPrevious} disabled={slide === 0}>
            Previous
          </button>
          <button
            type="button"
            className="secondary"
            onClick={goNext}
            disabled={slide === total - 1}
          >
            Next
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="primary" onClick={onExit}>
            Exit Presentation
          </button>
        </footer>
      </div>
    </section>
  )
}

function formatCost(raw: string): string {
  const n = Number(raw.replace(/[^0-9.]/gu, ''))
  if (Number.isNaN(n)) return raw
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}