import { describe, expect, it } from 'vitest'
import type { StorageProvider } from '../lib/storage'
import {
  STORAGE_KEY,
  deleteEvaluation,
  duplicateEvaluation,
  loadAll,
  newEvaluation,
  renameEvaluation,
  upsertEvaluation,
  upsertEvaluationMeta,
} from '../lib/storage'
import { createSampleEvaluation } from '../lib/sample'
import { BUSINESS_PARAMETERS, PRODUCTS } from '../lib/catalog'
import { buildQuote, freezeQuote } from '../lib/quote'
import { computeScore } from '../lib/scoring'
import { answersForCategory } from '../test/fixtures'

class MemoryStorage implements StorageProvider {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  readAll(): string | null {
    return this.map.get(STORAGE_KEY) ?? null
  }
}

describe('storage', () => {
  it('saves and restores evaluations from the provider', () => {
    const mem = new MemoryStorage()
    const created = newEvaluation('My bakery')
    const list1 = upsertEvaluation([], created, mem)
    expect(list1).toHaveLength(1)

    const restored = loadAll(mem)
    expect(restored).toHaveLength(1)
    expect(restored[0].id).toBe(created.id)
    expect(restored[0].name).toBe('My bakery')
    expect(restored[0].profile).toEqual(created.profile)
  })

  it('updates an existing evaluation in place', () => {
    const mem = new MemoryStorage()
    const created = newEvaluation('A')
    let list = upsertEvaluation([], created, mem)
    const modified = { ...created, name: 'B', profile: { ...created.profile, businessName: 'Corner Cafe' } }
    list = upsertEvaluation(list, modified, mem)
    expect(list).toHaveLength(1)
    const restored = loadAll(mem)
    expect(restored[0].name).toBe('B')
    expect(restored[0].profile.businessName).toBe('Corner Cafe')
  })

  it('renames, duplicates, and deletes evaluations', () => {
    const mem = new MemoryStorage()
    const created = newEvaluation('Name')
    let list = upsertEvaluation([], created, mem)

    list = renameEvaluation(list, created.id, 'Renamed', mem)
    expect(loadAll(mem)[0].name).toBe('Renamed')

    list = duplicateEvaluation(list, created.id, mem)
    expect(list).toHaveLength(2)
    expect(list[1].name).toBe('Renamed (copy)')
    expect(list[1].id).not.toBe(created.id)

    list = deleteEvaluation(list, created.id, mem)
    expect(list).toHaveLength(1)
    expect(loadAll(mem)[0].id).toBe(list[0].id)
  })

  it('round-trips answers through the provider', () => {
    const mem = new MemoryStorage()
    const created = newEvaluation('With answers')
    const withAnswers = {
      ...created,
      answers: answersForCategory('customer-problem', [5, 4, 3, 2]),
    }
    upsertEvaluation([], withAnswers, mem)
    const restored = loadAll(mem)[0]
    expect(restored.answers['customer-problem__0']).toEqual({ value: 5, note: '' })
  })

  it('ignores corrupt data instead of crashing', () => {
    const mem = new MemoryStorage()
    mem.setItem(STORAGE_KEY, 'not json {')
    expect(loadAll(mem)).toEqual([])
  })

  it('loads an exported sample evaluation and keeps its answers', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    upsertEvaluation([], sample, mem)
    const restored = loadAll(mem)
    expect(restored[0].name).toContain('SAMPLE')
    expect(Object.keys(restored[0].answers).length).toBeGreaterThan(30)
  })

  it('preserves a frozen quotation across a save and reload', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const score = computeScore(sample.answers)
    const snapshot = freezeQuote(buildQuote(sample, score, BUSINESS_PARAMETERS, PRODUCTS), sample)
    upsertEvaluationMeta([], { ...sample, quoteSnapshot: snapshot }, mem)

    const restored = loadAll(mem)[0]
    expect(restored.quoteSnapshot).toBeDefined()
    expect(restored.quoteSnapshot!.number).toBe(snapshot.number)
    expect(restored.quoteSnapshot!.total).toBe(snapshot.total)
    expect(restored.quoteSnapshot!.lines.length).toBe(snapshot.lines.length)
    expect(restored.quoteSnapshot!.evaluationUpdatedAt).toBe(sample.updatedAt)
  })

  it('drops a structurally invalid frozen quotation rather than crashing', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const list = upsertEvaluation([], sample, mem)
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { ...list[0], quoteSnapshot: { number: 42, issuedAt: 'nope', lines: 'bad' } },
      ]),
    )
    expect(loadAll(mem)[0].quoteSnapshot).toBeUndefined()
  })

  it('drops a legacy frozen quotation that predates the staleness stamp', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const list = upsertEvaluation([], sample, mem)
    const legacy = {
      number: 'Q-20260301-ABC123',
      evaluationId: sample.id,
      issuedAt: '2026-03-01T00:00:00.000Z',
      validUntil: '2026-03-31T00:00:00.000Z',
      total: 1000,
      lines: [],
    }
    mem.setItem(STORAGE_KEY, JSON.stringify([{ ...list[0], quoteSnapshot: legacy }]))
    expect(loadAll(mem)[0].quoteSnapshot).toBeUndefined()
  })

  it('does not carry a frozen quotation onto a duplicate', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const score = computeScore(sample.answers)
    const snapshot = freezeQuote(buildQuote(sample, score, BUSINESS_PARAMETERS, PRODUCTS), sample)
    let list = upsertEvaluationMeta([], { ...sample, quoteSnapshot: snapshot }, mem)

    list = duplicateEvaluation(list, sample.id, mem)
    expect(list[1].quoteSnapshot).toBeUndefined()
    // the original keeps its own frozen quote
    expect(list[0].quoteSnapshot?.number).toBe(snapshot.number)
  })

  it('leaves updatedAt alone when only quote metadata changes', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const score = computeScore(sample.answers)
    const snapshot = freezeQuote(buildQuote(sample, score, BUSINESS_PARAMETERS, PRODUCTS), sample)
    const list = upsertEvaluation([], sample, mem)
    const stamp = list[0].updatedAt

    const attached = upsertEvaluationMeta(
      list,
      { ...list[0], quoteSnapshot: snapshot },
      mem,
    )
    expect(attached[0].updatedAt).toBe(stamp)

    const detached = upsertEvaluationMeta(attached, { ...attached[0] }, mem)
    expect(detached[0].updatedAt).toBe(stamp)
    expect(loadAll(mem)[0].updatedAt).toBe(stamp)
  })

  it('moves updatedAt when the answers actually change', () => {
    const mem = new MemoryStorage()
    const sample = createSampleEvaluation()
    const list = upsertEvaluation([], sample, mem)
    const stamp = list[0].updatedAt

    const edited = upsertEvaluation(
      list,
      { ...list[0], answers: { 'customer-problem__0': { value: 4, note: '' } } },
      mem,
    )
    expect(new Date(edited[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(stamp).getTime(),
    )
    expect(edited[0].quoteSnapshot).toBeUndefined()
  })
})