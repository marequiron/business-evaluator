import type { Evaluation } from '../types'
import { classify } from '../lib/scoring'
import type { EvaluationScore } from '../lib/scoring'
import type { Report } from '../lib/recommendations'
import { ScoreBars } from './ScoreBars'

interface Props {
  evaluation: Evaluation
  score: EvaluationScore
  report: Report
  onBack: () => void
  onPresentation: () => void
  onEditAnswers: () => void
  onExportCsv: () => void
  onViewQuotation: () => void
}

export function ResultsDashboard({
  evaluation,
  score,
  report,
  onBack,
  onPresentation,
  onEditAnswers,
  onExportCsv,
  onViewQuotation,
}: Props) {
  const classification = classify(score.overall)
  const businessName = evaluation.profile.businessName || evaluation.name

  return (
    <section aria-labelledby="results-title">
      <div id="report-root">
        <div className="report-header">
          <p className="kicker">Results</p>
          <h1 id="results-title">{businessName}</h1>
          <p className="muted">
            Evaluated on {new Date(evaluation.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <div className={'overall-card tone-' + classification.tone}>
          <div className="overall-score">
            <span className="overall-number">{score.overall}</span>
            <span className="overall-of">out of 100</span>
          </div>
          <div className="overall-copy">
            <h2>{classification.name}</h2>
            <p>{classification.description}</p>
            <p className="hint">
              Answered {score.totalAnswered} of {score.totalQuestions} questions. Unanswered
              questions are counted as zeroes, so gaps are visible, not hidden.
            </p>
          </div>
        </div>

        <h2 className="section-title">Category scores</h2>
        <ScoreBars categories={score.categories} />

        <div className="results-grid">
          <div className="results-panel">
            <h2 className="section-title">Category detail</h2>
            <ul className="category-card-list">
              {score.categories.map((c) => (
                <li key={c.id} className={'category-card card score-' + band(c.score100)}>
                  <div className="category-card-head">
                    <h3>{c.label}</h3>
                    <span className="category-score">{Math.round(c.score100)}</span>
                  </div>
                  <p className="hint">
                    {c.answeredCount} of {c.questionCount} answered
                    {c.unansweredCount > 0 ? (
                      <span className="unanswered-flag"> — {c.unansweredCount} unanswered</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="results-panel">
            <h2 className="section-title">Top strengths</h2>
            {report.strengths.length > 0 ? (
              <ul className="plain-list">
                {report.strengths.map((s) => (
                  <li key={s.id}>
                    <strong>{s.label}</strong> — {Math.round(s.score100)}/100
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No category has reached 60 yet. That is a signal to validate first, not to give up.
              </p>
            )}

            <h2 className="section-title">Three most important improvement areas</h2>
            <ol className="numbered-list">
              {report.improvements.map((i) => (
                <li key={i.id}>
                  <strong>{i.label}</strong> ({Math.round(i.score100)}/100) — {i.weakestQuestion}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="results-panel">
          <h2 className="section-title">Critical business assumptions</h2>
          <ul className="plain-list">
            {report.assumptions.map((a, i) => (
              <li key={i}>
                <strong>{a.categoryLabel}:</strong> {a.statement}
              </li>
            ))}
          </ul>
        </div>

        <div className="results-panel">
          <h2 className="section-title">Key risks and suggested treatments</h2>
          {report.risks.length > 0 ? (
            <ul className="risk-list">
              {report.risks.map((r) => (
                <li key={r.id}>
                  <h3>{r.label} ({Math.round(r.score100)}/100)</h3>
                  <p className="risk-text">
                    <strong>Risk:</strong> {r.risk}
                  </p>
                  <p className="treatment-text">
                    <strong>Treatment:</strong> {r.treatment}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No category is below the risk line. Keep monitoring your weakest areas as you grow.
            </p>
          )}
        </div>

        <div className="results-panel">
          <h2 className="section-title">Personalised recommendations</h2>
          <ul className="numbered-list">
            {report.recommendations.map((r) => (
              <li key={r.categoryId}>
                <strong>{r.label}</strong> — {r.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="results-panel highlight">
          <h2 className="section-title">Immediate next action</h2>
          <p>{report.immediateAction}</p>
        </div>

        <div className="results-grid">
          <div className="results-panel">
            <h2 className="section-title">30-day action plan</h2>
            <ol className="numbered-list">
              {report.plan30.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
          <div className="results-panel">
            <h2 className="section-title">90-day action plan</h2>
            <ol className="numbered-list">
              {report.plan90.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="results-panel">
          <h2 className="section-title">Long-term sustainability actions</h2>
          <ol className="numbered-list">
            {report.sustainabilityActions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </div>

        <div className="results-panel">
          <h2 className="section-title">Next milestone</h2>
          <p>{report.nextStepGoal}</p>
        </div>

        <div className="results-panel highlight">
          <h2 className="section-title">What would it cost to close these gaps?</h2>
          <p>
            See which services are available for this idea now, which unlock as you score higher,
            and what the total comes to.
          </p>
          <button type="button" className="primary" onClick={onViewQuotation}>
            View quotation
          </button>
        </div>
      </div>

      <div className="results-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="primary" onClick={onPresentation}>
          Presentation Mode
        </button>
        <button type="button" className="secondary" onClick={onEditAnswers}>
          Edit answers
        </button>
        <button type="button" className="secondary" onClick={() => window.print()}>
          Save as PDF
        </button>
        <button type="button" className="ghost" onClick={onExportCsv}>
          Export CSV
        </button>
      </div>
    </section>
  )
}

function band(score: number): string {
  if (score < 40) return 'low'
  if (score < 60) return 'mid'
  if (score < 80) return 'high'
  return 'top'
}