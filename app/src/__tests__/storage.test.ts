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
} from '../lib/storage'
import { createSampleEvaluation } from '../lib/sample'
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
})