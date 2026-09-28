import { describe, expect, it } from 'vitest'
import {
  csvRowsToText,
  evaluationToJson,
  evaluationsToCsv,
  evaluationsToJson,
  importEvaluations,
  parseEvaluationJson,
  parseEvaluationsJson,
} from '../lib/io'
import { computeScore } from '../lib/scoring'
import { createSampleEvaluation } from '../lib/sample'
import { answersForCategory, makeEvaluation } from '../test/fixtures'

describe('JSON import and export', () => {
  it('exports and re-imports a single evaluation losslessly', () => {
    const ev = makeEvaluation()
    const withAnswers = { ...ev, answers: answersForCategory('market-opportunity', [4, 3, 2, 1]) }
    const json = evaluationToJson(withAnswers)
    const parsed = parseEvaluationJson(json)
    expect(parsed).toEqual(withAnswers)
  })

  it('exports and re-imports a list of evaluations', () => {
    const a = makeEvaluation()
    const b = createSampleEvaluation()
    const json = evaluationsToJson([a, b])
    const list = parseEvaluationsJson(json)
    expect(list).toHaveLength(2)
  })

  it('merges imported evaluations without duplicating ids', () => {
    const a = makeEvaluation()
    const b = createSampleEvaluation()
    expect(a.id).not.toBe(b.id)
    const merged = importEvaluations([a], [a, b])
    expect(merged).toHaveLength(2)
    expect(merged.filter((e) => e.id === a.id)).toHaveLength(1)
  })

  it('rejects malformed JSON with a clear error', () => {
    expect(() => parseEvaluationsJson('{')).toThrow('not valid JSON')
    expect(() => parseEvaluationsJson('{"format":"other"}')).toThrow('not a business evaluator export')
    expect(() => parseEvaluationsJson('[1,2,3]')).toThrow('No valid evaluations')
  })

  it('accepts a bare evaluation object as an import', () => {
    const ev = makeEvaluation()
    const parsed = parseEvaluationsJson(JSON.stringify(ev))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(ev.id)
  })
})

describe('CSV export', () => {
  it('writes a header row plus one row per question', () => {
    const ev = makeEvaluation()
    const withAnswers = { ...ev, answers: answersForCategory('customer-problem', [5, 4, 3, 2]) }
    const scores = { [withAnswers.id]: computeScore(withAnswers.answers) }
    const csv = evaluationsToCsv([withAnswers], scores)

    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('Evaluation ID')
    expect(lines[0]).toContain('Overall Score (0-100)')
    // 1 header + 40 questions
    expect(lines.length).toBe(41)
  })

  it('marks unanswered questions as No with an empty answer', () => {
    const ev = makeEvaluation()
    const scores = { [ev.id]: computeScore(ev.answers) }
    const csv = evaluationsToCsv([ev], scores)
    expect(csv).toContain('No')
  })

  it('escapes quotes, commas, and newlines inside cells', () => {
    const rows = [['plain', 'has,comma', 'has "quote"', 'line\nbreak']]
    const text = csvRowsToText(rows)
    expect(text).toBe('plain,"has,comma","has ""quote""","line\nbreak"')
  })

  it('includes the classification for the sample evaluation', () => {
    const sample = createSampleEvaluation()
    const scores = { [sample.id]: computeScore(sample.answers) }
    const csv = evaluationsToCsv([sample], scores)
    expect(csv).toContain('Promising but needs improvement')
  })
})