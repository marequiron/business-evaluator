import type { Evaluation, Profile } from '../types'
import { CATEGORIES } from './questions'
import { answerLabel, answerKey } from './scoring'
import type { EvaluationScore } from './scoring'

export interface JsonDocument {
  format: 'business-evaluator'
  version: 1
  evaluations: Evaluation[]
}

export function evaluationToJson(e: Evaluation): string {
  return JSON.stringify(
    {
      format: 'business-evaluator',
      version: 1,
      evaluations: [e],
    },
    null,
    2,
  )
}

export function evaluationsToJson(list: Evaluation[]): string {
  return JSON.stringify(
    {
      format: 'business-evaluator',
      version: 1,
      evaluations: list,
    },
    null,
    2,
  )
}

function isProfileLike(value: unknown): value is Profile {
  if (typeof value !== 'object' || value == null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.businessName === 'string' &&
    typeof obj.businessDescription === 'string' &&
    typeof obj.problemSolved === 'string' &&
    typeof obj.productService === 'string' &&
    typeof obj.targetCustomers === 'string' &&
    typeof obj.geographicMarket === 'string' &&
    typeof obj.revenueModel === 'string' &&
    typeof obj.startupCost === 'string' &&
    typeof obj.shortTermObjective === 'string' &&
    typeof obj.longTermVision === 'string'
  )
}

function isEvaluationLike(value: unknown): value is Evaluation {
  if (typeof value !== 'object' || value == null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.profile === 'object' &&
    isProfileLike(obj.profile) &&
    typeof obj.answers === 'object' &&
    obj.answers != null
  )
}

export function parseEvaluationsJson(text: string): Evaluation[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new Error('The JSON does not contain an evaluation.')
  }

  const doc = parsed as Partial<JsonDocument>
  if (doc.format === 'business-evaluator' && Array.isArray(doc.evaluations)) {
    const list = doc.evaluations.filter(isEvaluationLike)
    if (list.length === 0) throw new Error('No valid evaluations were found in the file.')
    return list
  }

  if (Array.isArray(parsed)) {
    const list = parsed.filter(isEvaluationLike)
    if (list.length === 0) throw new Error('No valid evaluations were found in the file.')
    return list
  }

  if (isEvaluationLike(parsed)) {
    return [parsed]
  }

  throw new Error('The file is not a business evaluator export.')
}

export function parseEvaluationJson(text: string): Evaluation {
  const list = parseEvaluationsJson(text)
  return list[0]
}

export function importEvaluations(list: Evaluation[], incoming: Evaluation[]): Evaluation[] {
  const next = [...list]
  for (const item of incoming) {
    const idx = next.findIndex((e) => e.id === item.id)
    if (idx >= 0) next[idx] = item
    else next.push(item)
  }
  return next
}

function csvCell(value: string): string {
  if (/[",\r\n]/u.test(value)) {
    return '"' + value.replace(/"/gu, '""') + '"'
  }
  return value
}

export function csvRowsToText(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function evaluationsToCsv(
  list: Evaluation[],
  scores: Record<string, EvaluationScore>,
): string {
  const header = [
    'Evaluation ID',
    'Evaluation Name',
    'Updated At',
    'Category',
    'Question',
    'Answer (1-5)',
    'Answer Label',
    'Answered',
    'Note',
    'Category Score (0-100)',
    'Overall Score (0-100)',
    'Classification',
  ]

  const rows: string[][] = [header]

  for (const evalItem of list) {
    const score = scores[evalItem.id]
    for (const cat of CATEGORIES) {
      const catScore = score?.categories.find((c) => c.id === cat.id)
      cat.questions.forEach((q, idx) => {
        const raw = evalItem.answers[answerKey(cat.id, idx)]
        const value = raw && typeof raw.value === 'number' ? raw.value : null
        rows.push([
          evalItem.id,
          evalItem.name,
          evalItem.updatedAt,
          cat.label,
          q.text,
          value == null ? '' : String(value),
          value == null ? '' : answerLabel(value),
          value == null ? 'No' : 'Yes',
          raw?.note ?? '',
          catScore ? String(catScore.score100) : '',
          score ? String(score.overall) : '',
          score ? classifyName(score.overall) : '',
        ])
      })
    }
  }

  return csvRowsToText(rows)
}

function classifyName(overall: number): string {
  if (overall < 40) return 'Early concept requiring validation'
  if (overall < 60) return 'Promising but needs improvement'
  if (overall < 80) return 'Strong concept with manageable gaps'
  return 'Presentation-ready concept requiring continued validation'
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}