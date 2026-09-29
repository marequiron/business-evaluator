import type { Evaluation, QuoteSnapshot } from '../types'

export interface StorageProvider {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const browserStorage: StorageProvider = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // storage can be unavailable (private mode / quota); the app stays usable in memory
    }
  },
}

export const STORAGE_KEY = 'business-evaluator-evaluations-v1'
export const BACKUP_KEY = 'business-evaluator-evaluations-v1-corrupt'

export function generateId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function newEvaluation(name: string, now = new Date().toISOString()) {
  return {
    id: generateId(),
    name: name.replace(/\s+$/u, '') || 'Untitled evaluation',
    createdAt: now,
    updatedAt: now,
    profile: { businessName: '', businessDescription: '', problemSolved: '', productService: '', targetCustomers: '', geographicMarket: '', revenueModel: '', startupCost: '', shortTermObjective: '', longTermVision: '' },
    answers: {},
  }
}

export function loadAll(provider: StorageProvider = browserStorage): Evaluation[] {
  try {
    const raw = provider.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEvaluation).map(withDefaults)
  } catch {
    return []
  }
}

function isEvaluation(value: unknown): value is Evaluation {
  if (typeof value !== 'object' || value == null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.profile === 'object' &&
    obj.profile != null &&
    typeof obj.answers === 'object' &&
    obj.answers != null
  )
}

function withDefaults(e: Evaluation): Evaluation {
  const base: Evaluation = {
    id: e.id,
    name: e.name || 'Untitled evaluation',
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
    profile: {
      businessName: e.profile.businessName ?? '',
      businessDescription: e.profile.businessDescription ?? '',
      problemSolved: e.profile.problemSolved ?? '',
      productService: e.profile.productService ?? '',
      targetCustomers: e.profile.targetCustomers ?? '',
      geographicMarket: e.profile.geographicMarket ?? '',
      revenueModel: e.profile.revenueModel ?? '',
      startupCost: e.profile.startupCost ?? '',
      shortTermObjective: e.profile.shortTermObjective ?? '',
      longTermVision: e.profile.longTermVision ?? '',
    },
    answers: e.answers,
  }
  // Only carry a frozen quotation through if it is structurally intact.
  if (isQuoteSnapshot(e.quoteSnapshot)) {
    base.quoteSnapshot = e.quoteSnapshot
  }
  return base
}

function isQuoteSnapshot(value: unknown): value is QuoteSnapshot {
  if (typeof value !== 'object' || value == null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.number === 'string' &&
    typeof obj.issuedAt === 'string' &&
    typeof obj.evaluationUpdatedAt === 'string' &&
    typeof obj.validUntil === 'string' &&
    typeof obj.total === 'number' &&
    typeof obj.tierDiscountPct === 'number' &&
    typeof obj.sequentialWeeks === 'number' &&
    typeof obj.parallelWeeks === 'number' &&
    typeof obj.parallelism === 'number' &&
    Array.isArray(obj.lines)
  )
}

function persist(list: Evaluation[], provider: StorageProvider): void {
  provider.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function upsertEvaluation(
  list: Evaluation[],
  item: Evaluation,
  provider: StorageProvider = browserStorage,
): Evaluation[] {
  return storeEvaluation(
    list,
    { ...item, updatedAt: new Date().toISOString() },
    provider,
  )
}

/**
 * Save an evaluation *without* moving `updatedAt`.
 *
 * `updatedAt` means "when did the answers last change?", which is what quote
 * staleness is measured against. Attaching or detaching a frozen quote does not
 * change any answer, so it must not bump that stamp — otherwise a quote is
 * reported stale the instant it is created.
 */
export function upsertEvaluationMeta(
  list: Evaluation[],
  item: Evaluation,
  provider: StorageProvider = browserStorage,
): Evaluation[] {
  return storeEvaluation(list, item, provider)
}

function storeEvaluation(
  list: Evaluation[],
  item: Evaluation,
  provider: StorageProvider,
): Evaluation[] {
  const next = list.some((e) => e.id === item.id)
    ? list.map((e) => (e.id === item.id ? item : e))
    : [...list, item]
  persist(next, provider)
  return next
}

export function deleteEvaluation(
  list: Evaluation[],
  id: string,
  provider: StorageProvider = browserStorage,
): Evaluation[] {
  const next = list.filter((e) => e.id !== id)
  persist(next, provider)
  return next
}

export function renameEvaluation(
  list: Evaluation[],
  id: string,
  name: string,
  provider: StorageProvider = browserStorage,
): Evaluation[] {
  const next = list.map((e) =>
    e.id === id ? { ...e, name: name || e.name, updatedAt: new Date().toISOString() } : e,
  )
  persist(next, provider)
  return next
}

export function duplicateEvaluation(
  list: Evaluation[],
  id: string,
  provider: StorageProvider = browserStorage,
): Evaluation[] {
  const source = list.find((e) => e.id === id)
  if (!source) return list
  const now = new Date().toISOString()
  const copy: Evaluation = {
    ...source,
    id: generateId(),
    name: source.name + ' (copy)',
    createdAt: now,
    updatedAt: now,
    answers: JSON.parse(JSON.stringify(source.answers)),
    profile: { ...source.profile },
  }
  // A quotation is issued against one evaluation; the copy starts unfrozen.
  delete copy.quoteSnapshot
  const next = [...list, copy]
  persist(next, provider)
  return next
}

export function findById(list: Evaluation[], id: string | null): Evaluation | undefined {
  return list.find((e) => e.id === id)
}

export function isComplete(evaluation: Evaluation): boolean {
  return evaluation.profile.businessName.trim().length > 0
}

export function sortedByUpdated(list: Evaluation[]): Evaluation[] {
  return list.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}