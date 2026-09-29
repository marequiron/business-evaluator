/*
 * Rate card (the editable offer).
 *
 * `catalog.ts` holds the *shipped defaults*. This module holds whatever the
 * user has overridden in the browser, persisted to its own localStorage key, and
 * is what the quotation engine actually reads.
 *
 * The two are combined by MERGING ON PRODUCT ID rather than by replacing the
 * array wholesale. That matters for upgrades: if a future release adds a product
 * or a field, a rate card saved from the previous version must not silently
 * shadow it. Anything the saved copy does not mention falls back to the shipped
 * default, and anything it mentions that no longer exists is ignored.
 *
 * Pure and DOM-free: every function takes an explicit `StorageProvider`, so the
 * whole module is testable without a browser.
 */

import type { StorageProvider } from './storage'
import { browserStorage } from './storage'
import { BUSINESS_PARAMETERS, PRODUCTS } from './catalog'
import type { BusinessParameters, Product, Tier } from './catalog'

export const RATE_CARD_KEY = 'business-evaluator-ratecard-v1'

/** Default number of services assumed to run at the same time. */
export const DEFAULT_PARALLELISM = 2

export interface RateCard {
  products: Product[]
  params: BusinessParameters
}

export type RateCardErrorKey =
  | `product.${string}.price`
  | `product.${string}.durationWeeks`
  | `product.${string}.minCategory`
  | `product.${string}.name`
  | 'params.minOverallToQuote'
  | 'params.quoteValidDays'
  | 'params.parallelism'
  | `tier.${string}.minOverall`
  | `tier.${string}.discountPct`

export type RateCardErrors = Partial<Record<RateCardErrorKey, string>>

/** The shipped catalog, untouched. Used as the baseline for every merge. */
export function defaultRateCard(): RateCard {
  return {
    products: PRODUCTS.map((p) => ({ ...p, categoryIds: p.categoryIds.slice(), deliverables: p.deliverables.slice() })),
    params: {
      ...BUSINESS_PARAMETERS,
      parallelism: DEFAULT_PARALLELISM,
      tiers: BUSINESS_PARAMETERS.tiers.map((t) => ({ ...t })),
    },
  }
}

/**
 * Fields a user may override. `id` and `categoryIds` are code-owned on purpose:
 * the category links are the assessment model, not the offer, and letting a
 * pricing screen detach a product from the gate that governs it would quietly
 * change what the evaluation means.
 */
function mergeProduct(base: Product, saved: Record<string, unknown>): Product {
  const out: Product = { ...base, categoryIds: base.categoryIds.slice(), deliverables: base.deliverables.slice() }
  if (typeof saved.name === 'string' && saved.name.trim() !== '') out.name = saved.name
  if (typeof saved.summary === 'string') out.summary = saved.summary
  if (Array.isArray(saved.deliverables)) {
    const list = saved.deliverables.filter((d): d is string => typeof d === 'string')
    if (list.length > 0) out.deliverables = list
  }
  if (typeof saved.price === 'number' && Number.isFinite(saved.price)) out.price = saved.price
  if (typeof saved.durationWeeks === 'number' && Number.isFinite(saved.durationWeeks)) {
    out.durationWeeks = saved.durationWeeks
  }
  if (typeof saved.minCategory === 'number' && Number.isFinite(saved.minCategory)) {
    out.minCategory = saved.minCategory
  }
  return out
}

function mergeTier(base: Tier, saved: Record<string, unknown>): Tier {
  const out: Tier = { ...base }
  if (typeof saved.minOverall === 'number' && Number.isFinite(saved.minOverall)) out.minOverall = saved.minOverall
  if (typeof saved.discountPct === 'number' && Number.isFinite(saved.discountPct)) {
    out.discountPct = saved.discountPct
  }
  return out
}

function mergeParams(base: BusinessParameters, saved: unknown): BusinessParameters {
  const out: BusinessParameters = { ...base, tiers: base.tiers.map((t) => ({ ...t })) }
  if (typeof saved !== 'object' || saved == null) return out
  const obj = saved as Record<string, unknown>
  if (typeof obj.minOverallToQuote === 'number' && Number.isFinite(obj.minOverallToQuote)) {
    out.minOverallToQuote = obj.minOverallToQuote
  }
  if (typeof obj.quoteValidDays === 'number' && Number.isFinite(obj.quoteValidDays)) {
    out.quoteValidDays = obj.quoteValidDays
  }
  if (typeof obj.parallelism === 'number' && Number.isFinite(obj.parallelism)) {
    out.parallelism = obj.parallelism
  }
  // Tier floors and discounts are matched by id so a re-ordered or newly added
  // tier does not scramble the saved edits.
  if (Array.isArray(obj.tiers)) {
    const byId = new Map<string, Record<string, unknown>>()
    for (const t of obj.tiers) {
      if (typeof t === 'object' && t != null) {
        const rec = t as Record<string, unknown>
        if (typeof rec.id === 'string') byId.set(rec.id, rec)
      }
    }
    out.tiers = out.tiers.map((t) => {
      const savedTier = byId.get(t.id)
      return savedTier ? mergeTier(t, savedTier) : { ...t }
    })
  }
  return out
}

/**
 * Combine the shipped defaults with a saved override.
 *
 * Tolerant by design: a corrupt or partial stored card degrades to the
 * defaults field by field rather than being rejected wholesale, so a bad write
 * can never leave the app unable to price anything.
 */
export function mergeRateCard(saved: unknown): RateCard {
  const base = defaultRateCard()
  if (typeof saved !== 'object' || saved == null) return base
  const obj = saved as Record<string, unknown>

  if (Array.isArray(obj.products)) {
    const byId = new Map<string, Record<string, unknown>>()
    for (const p of obj.products) {
      if (typeof p === 'object' && p != null) {
        const rec = p as Record<string, unknown>
        if (typeof rec.id === 'string') byId.set(rec.id, rec)
      }
    }
    base.products = base.products.map((p) => {
      const savedProduct = byId.get(p.id)
      return savedProduct ? mergeProduct(p, savedProduct) : p
    })
  }

  base.params = mergeParams(base.params, obj.params)
  return base
}

/** How many services the parallel timeline assumes run at once. */
export function parallelismOf(params: BusinessParameters): number {
  const n = params.parallelism ?? DEFAULT_PARALLELISM
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_PARALLELISM
}

export function rateCardEquals(a: RateCard, b: RateCard): boolean {
  return JSON.stringify(normaliseForCompare(a)) === JSON.stringify(normaliseForCompare(b))
}

function normaliseForCompare(card: RateCard) {
  return {
    products: card.products.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      price: p.price,
      durationWeeks: p.durationWeeks,
      deliverables: p.deliverables,
      minCategory: p.minCategory,
    })),
    params: {
      minOverallToQuote: card.params.minOverallToQuote,
      quoteValidDays: card.params.quoteValidDays,
      parallelism: parallelismOf(card.params),
      tiers: card.params.tiers.map((t) => ({ id: t.id, minOverall: t.minOverall, discountPct: t.discountPct })),
    },
  }
}

/**
 * Validate a candidate rate card. Pure, returns one message per bad field.
 * An empty result means the card is safe to apply.
 */
export function validateRateCard(card: RateCard): RateCardErrors {
  const errors: RateCardErrors = {}

  for (const p of card.products) {
    if (!Number.isFinite(p.price) || p.price < 0) {
      errors[`product.${p.id}.price`] = 'Price must be zero or more.'
    }
    if (!Number.isFinite(p.durationWeeks) || p.durationWeeks < 0) {
      errors[`product.${p.id}.durationWeeks`] = 'Duration must be zero or more.'
    } else if (!Number.isInteger(p.durationWeeks)) {
      errors[`product.${p.id}.durationWeeks`] = 'Duration must be a whole number of weeks.'
    }
    if (!Number.isFinite(p.minCategory) || p.minCategory < 0 || p.minCategory > 100) {
      errors[`product.${p.id}.minCategory`] = 'Unlock score must be between 0 and 100.'
    }
    if (p.name.trim() === '') {
      errors[`product.${p.id}.name`] = 'Service name is required.'
    }
  }

  const { params } = card
  if (!Number.isFinite(params.minOverallToQuote) || params.minOverallToQuote < 0 || params.minOverallToQuote > 100) {
    errors['params.minOverallToQuote'] = 'Entry score must be between 0 and 100.'
  }
  if (!Number.isFinite(params.quoteValidDays) || params.quoteValidDays < 1) {
    errors['params.quoteValidDays'] = 'Validity must be at least 1 day.'
  }
  const parallelism = params.parallelism
  if (!Number.isFinite(parallelism) || !Number.isInteger(parallelism) || parallelism < 1) {
    errors['params.parallelism'] = 'Parallelism must be a whole number of 1 or more.'
  }
  for (const t of params.tiers) {
    if (!Number.isFinite(t.minOverall) || t.minOverall < 0 || t.minOverall > 100) {
      errors[`tier.${t.id}.minOverall`] = 'Tier floor must be between 0 and 100.'
    }
    if (!Number.isFinite(t.discountPct) || t.discountPct < 0 || t.discountPct > 100) {
      errors[`tier.${t.id}.discountPct`] = 'Discount must be between 0 and 100.'
    }
  }

  return errors
}

export function isRateCardValid(card: RateCard): boolean {
  return Object.keys(validateRateCard(card)).length === 0
}

export function loadRateCard(provider: StorageProvider = browserStorage): RateCard {
  try {
    const raw = provider.getItem(RATE_CARD_KEY)
    if (!raw) return defaultRateCard()
    return mergeRateCard(JSON.parse(raw))
  } catch {
    return defaultRateCard()
  }
}

export function saveRateCard(card: RateCard, provider: StorageProvider = browserStorage): void {
  provider.setItem(RATE_CARD_KEY, JSON.stringify(card))
}

export function clearRateCard(provider: StorageProvider = browserStorage): void {
  provider.setItem(RATE_CARD_KEY, '')
}

export function isRateCardCustomised(card: RateCard): boolean {
  return !rateCardEquals(card, defaultRateCard())
}
