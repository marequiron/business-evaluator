import type { CategoryScore } from '../lib/scoring'

interface Props {
  categories: CategoryScore[]
}

export function ScoreBars({ categories }: Props) {
  return (
    <div className="score-chart">
      <table className="score-chart-table">
        <caption className="sr-only">Category scores on a 0 to 100 scale</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.label}</th>
              <td>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: c.score100 + '%' }} />
                </span>
                <span className="bar-label">{Math.round(c.score100)}</span>
              </td>
            </tr>
          ))}
          <tr className="bar-total">
            <th scope="row">Overall</th>
            <td>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill bar-fill-overall" style={{ width: overall(categories) + '%' }} />
              </span>
              <span className="bar-label">{overall(categories)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="sr-only" aria-live="polite">
        Highest category: {highest(categories)}.
      </p>
    </div>
  )
}

function overall(categories: CategoryScore[]): number {
  const total = categories.reduce((sum, c) => sum + c.score100 * c.weight, 0)
  return Math.round(total / Math.max(categories.reduce((sum, c) => sum + c.weight, 0), 1))
}

function highest(categories: CategoryScore[]): string {
  const best = categories.slice().sort((a, b) => b.score100 - a.score100)[0]
  return best ? best.label + ' at ' + Math.round(best.score100) : 'none'
}