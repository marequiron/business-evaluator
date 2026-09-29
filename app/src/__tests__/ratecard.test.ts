import { describe, expect, it } from 'vitest'
import {
  RATE_CARD_KEY,
  clearRateCard,
  defaultRateCard,
  isRateCardCustomised,
  isRateCardValid,
  loadRateCard,
  mergeRateCard as merge,
  parallelismOf,
  rateCardEquals,
  saveRateCard,
  validateRateCard,
} from '../lib/ratecard'
import type { RateCardErrorKey, RateCardErrors } from '../lib/ratecard'
import { STORAGE_KEY, type StorageProvider } from '../lib/storage'
import { BUSINESS_PARAMETERS, PRODUCTS } from '../lib/catalog'

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

describe('rate card defaults', () => {
  it('exposes the shipped catalog as the baseline', () => {
    const card = defaultRateCard()
    expect(card.products).toHaveLength(PRODUCTS.length)
    expect(card.params.minOverallToQuote).toBe(BUSINESS_PARAMETERS.minOverallToQuote)
    expect(card.params.parallelism).toBe(2)
    expect(isRateCardCustomised(card)).toBe(false)
  })

  it('returns a detached copy so editing cannot mutate the module constants', () => {
    const a = defaultRateCard()
    a.products[0].price = 1
    a.products[0].deliverables.push('injected')
    a.params.tiers[0].discountPct = 99
    const b = defaultRateCard()
    expect(b.products[0].price).toBe(PRODUCTS[0].price)
    expect(b.products[0].deliverables).toEqual(PRODUCTS[0].deliverables)
    expect(b.params.tiers[0].discountPct).toBe(BUSINESS_PARAMETERS.tiers[0].discountPct)
  })
})

describe('merging a saved rate card', () => {
  it('overrides the fields that were saved and leaves the rest alone', () => {
    const merged = merge({
      products: [{ id: PRODUCTS[0].id, price: 12345 }],
      params: { minOverallToQuote: 55 },
    })
    expect(merged.products[0].price).toBe(12345)
    expect(merged.products[0].name).toBe(PRODUCTS[0].name)
    expect(merged.params.minOverallToQuote).toBe(55)
    expect(merged.params.quoteValidDays).toBe(BUSINESS_PARAMETERS.quoteValidDays)
  })

  it('keeps products added in a later release rather than shadowing them', () => {
    const savedOnlyOld = {
      products: [{ id: PRODUCTS[0].id, price: 1 }],
      params: {},
    }
    const merged = merge(savedOnlyOld)
    expect(merged.products).toHaveLength(PRODUCTS.length)
    for (const p of PRODUCTS) {
      expect(merged.products.some((m) => m.id === p.id)).toBe(true)
    }
  })

  it('ignores saved entries for products that no longer exist', () => {
    const merged = merge({ products: [{ id: 'retired-service', price: 1 }] })
    expect(merged.products).toHaveLength(PRODUCTS.length)
    expect(merged.products.some((p) => p.id === 'retired-service')).toBe(false)
  })

  it('matches tiers by id so reordering does not scramble the edits', () => {
    const merged = merge({
      params: {
        tiers: [
          { id: 'scale', discountPct: 15 },
          { id: 'foundation', discountPct: 2 },
        ],
      },
    })
    const byId = Object.fromEntries(merged.params.tiers.map((t) => [t.id, t]))
    expect(byId.scale.discountPct).toBe(15)
    expect(byId.foundation.discountPct).toBe(2)
    expect(merged.params.tiers.map((t) => t.id)).toEqual(
      BUSINESS_PARAMETERS.tiers.map((t) => t.id),
    )
  })

  it('degrades to defaults rather than throwing on corrupt data', () => {
    for (const bad of [null, undefined, 'nope', 42, [], { products: 'no' }]) {
      expect(merge(bad)).toEqual(defaultRateCard())
    }
  })

  it('ignores non-numeric and negative-but-invalid overrides field by field', () => {
    const merged = merge({
      products: [{ id: PRODUCTS[0].id, price: 'free', durationWeeks: null }],
    })
    expect(merged.products[0].price).toBe(PRODUCTS[0].price)
    expect(merged.products[0].durationWeeks).toBe(PRODUCTS[0].durationWeeks)
  })
})

describe('rate card persistence', () => {
  it('round-trips through the provider', () => {
    const mem = new MemoryStorage()
    const card = defaultRateCard()
    card.products[0].price = 51500
    card.params.quoteValidDays = 14
    saveRateCard(card, mem)
    expect(mem.getItem(RATE_CARD_KEY)).not.toBeNull()

    const loaded = loadRateCard(mem)
    expect(loaded.products[0].price).toBe(51500)
    expect(loaded.params.quoteValidDays).toBe(14)
  })

  it('returns defaults when nothing is stored', () => {
    const mem = new MemoryStorage()
    expect(loadRateCard(mem)).toEqual(defaultRateCard())
  })

  it('returns defaults when the stored value is not valid JSON', () => {
    const mem = new MemoryStorage()
    mem.setItem(RATE_CARD_KEY, '{ not json')
    expect(loadRateCard(mem)).toEqual(defaultRateCard())
  })

  it('clears back to the shipped defaults', () => {
    const mem = new MemoryStorage()
    const card = defaultRateCard()
    card.products[0].price = 1
    saveRateCard(card, mem)
    expect(isRateCardCustomised(loadRateCard(mem))).toBe(true)

    clearRateCard(mem)
    expect(loadRateCard(mem)).toEqual(defaultRateCard())
    expect(isRateCardCustomised(loadRateCard(mem))).toBe(false)
  })
})

describe('rate card validation', () => {
  /** Error keys are `product.<id>.<field>`, so index them through a typed helper. */
  function productError(errors: RateCardErrors, index: number, field: string): string | undefined {
    return errors[`product.${PRODUCTS[index].id}.${field}` as RateCardErrorKey]
  }

  it('accepts the defaults', () => {
    expect(validateRateCard(defaultRateCard())).toEqual({})
    expect(isRateCardValid(defaultRateCard())).toBe(true)
  })

  it('rejects a negative price', () => {
    const card = defaultRateCard()
    card.products[0].price = -1
    expect(productError(validateRateCard(card), 0, 'price')).toBeTruthy()
  })

  it('rejects a fractional duration', () => {
    const card = defaultRateCard()
    card.products[1].durationWeeks = 2.5
    expect(productError(validateRateCard(card), 1, 'durationWeeks')).toContain('whole number')
  })

  it('rejects an unlock threshold outside 0-100', () => {
    const card = defaultRateCard()
    card.products[0].minCategory = 140
    expect(productError(validateRateCard(card), 0, 'minCategory')).toBeTruthy()
  })

  it('rejects an empty service name', () => {
    const card = defaultRateCard()
    card.products[0].name = '   '
    expect(productError(validateRateCard(card), 0, 'name')).toBeTruthy()
  })

  it('rejects out-of-range rules', () => {
    const card = defaultRateCard()
    card.params.minOverallToQuote = 120
    card.params.quoteValidDays = 0
    card.params.parallelism = 0
    const errors = validateRateCard(card)
    expect(errors['params.minOverallToQuote']).toBeTruthy()
    expect(errors['params.quoteValidDays']).toBeTruthy()
    expect(errors['params.parallelism']).toBeTruthy()
  })

  it('rejects a discount over 100 percent', () => {
    const card = defaultRateCard()
    card.params.tiers[0].discountPct = 150
    expect(validateRateCard(card)['tier.foundation.discountPct']).toBeTruthy()
  })

  it('reports every bad field at once rather than stopping at the first', () => {
    const card = defaultRateCard()
    card.products[0].price = -5
    card.products[1].price = -6
    card.params.parallelism = 0
    expect(Object.keys(validateRateCard(card)).length).toBe(3)
  })
})

describe('parallelism helper', () => {
  it('falls back to 2 for nonsense input', () => {
    const base = defaultRateCard().params
    expect(parallelismOf({ ...base, parallelism: 0 })).toBe(2)
    expect(parallelismOf({ ...base, parallelism: NaN })).toBe(2)
    expect(parallelismOf({ ...base, parallelism: 3.7 })).toBe(3)
  })
})

describe('rateCardEquals', () => {
  it('ignores array identity', () => {
    expect(rateCardEquals(defaultRateCard(), defaultRateCard())).toBe(true)
  })

  it('sees a single changed peso', () => {
    const a = defaultRateCard()
    const b = defaultRateCard()
    b.products[0].price = a.products[0].price + 1
    expect(rateCardEquals(a, b)).toBe(false)
  })
})
