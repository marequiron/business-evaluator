import type { Evaluation, QuoteSnapshot } from '../types'
import type { BusinessParameters, Product, Tier } from './catalog'
import { categoryById } from './questions'
import { parallelismOf } from './ratecard'
import type { CategoryScore, EvaluationScore } from './scoring'

/*
 * Quotation engine (pure, DOM-free, fully unit-tested).
 *
 * A quotation is DERIVED, never stored as the source of truth. It is rebuilt
 * from the current answers on every render, so changing a rating updates the
 * price immediately. Freezing a quotation into a numbered proposal is a
 * separate, explicit action (see snapshot.ts).
 *
 * Two independent gates decide whether a line is quotable:
 *
 *   1. Entry gate    - overall score must reach `minOverallToQuote`.
 *   2. Product gate  - EVERY category the product links to must reach that
 *                      product's `minCategory`.
 *
 * A locked line is never hidden. It is shown with the exact condition that
 * would unlock it, because a wall reads as a rejection and a goal reads as
 * something to work towards. This matches the tone the rest of the app
 * takes: low scores are "early stage", not a verdict.
 */

export interface QuoteLine {
  product: Product
  eligible: boolean
  /** Human-readable, client-safe explanation. Never empty. */
  reason: string
  /** The lowest score among the product's linked categories. */
  weakestCategoryId: string
  weakestCategoryLabel: string
  weakestCategoryScore: number
}

export interface Quote {
  number: string
  lines: QuoteLine[]
  /** Sum of eligible lines only. This is the *list* price, before any tier discount. */
  subtotal: number
  discount: number
  total: number
  currency: BusinessParameters['currency']
  tier: Tier
  overall: number
  eligibleCount: number
  lockedCount: number
  issuedAt: string
  validUntil: string
  isExpired: boolean
  /** Every service one after the other. */
  sequentialWeeks: number
  /** Longest lane when the work is packed into `parallelism` concurrent streams. */
  parallelWeeks: number
  /** The assumption behind `parallelWeeks`, echoed so the UI can state it. */
  parallelism: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * Stable, human-readable quote reference derived from the evaluation.
 * Deterministic so re-quoting the same evaluation does not churn the number.
 */
export function quoteNumber(evaluationId: string, issuedAt: string): string {
  const suffix = evaluationId.replace(/[^a-zA-Z0-9]/gu, '').slice(-6).toUpperCase() || '000000'
  const day = issuedAt.slice(0, 10).replace(/-/gu, '')
  return 'Q-' + day + '-' + suffix
}

/** The tier whose floor the overall score has reached. Falls back to the first. */
export function tierFor(overall: number, tiers: Tier[]): Tier {
  const sorted = tiers.slice().sort((a, b) => b.minOverall - a.minOverall)
  for (const tier of sorted) {
    if (overall >= tier.minOverall) return tier
  }
  return sorted[sorted.length - 1] ?? { id: 'none', name: 'No tier', minOverall: 0, discountPct: 0 }
}

function buildLine(
  product: Product,
  categories: Map<string, CategoryScore>,
  entryBlocked: boolean,
  overall: number,
  params: BusinessParameters,
): QuoteLine {
  const linked = product.categoryIds
    .map((id) => categories.get(id))
    .filter((c): c is CategoryScore => c != null)

  const weakest = linked.slice().sort((a, b) => a.score100 - b.score100)[0]
  const weakestId = weakest?.id ?? product.categoryIds[0] ?? ''
  const weakestLabel = weakest?.label ?? categoryById(weakestId)?.label ?? 'this area'
  const weakestScore = weakest?.score100 ?? 0

  if (entryBlocked) {
    return {
      product,
      eligible: false,
      reason:
        'Unlocks at an overall score of ' +
        params.minOverallToQuote +
        '. You are at ' +
        overall +
        ' — keep validating and this becomes available.',
      weakestCategoryId: weakestId,
      weakestCategoryLabel: weakestLabel,
      weakestCategoryScore: weakestScore,
    }
  }

  const below = linked.filter((c) => c.score100 < product.minCategory)
  if (below.length > 0) {
    const names = below.map((c) => c.label + ' (' + Math.round(c.score100) + ')')
    return {
      product,
      eligible: false,
      reason:
        'Unlocks when ' +
        names.join(' and ') +
        ' reach ' +
        product.minCategory +
        ' or above. Currently ' +
        Math.round(weakestScore) +
        '.',
      weakestCategoryId: weakestId,
      weakestCategoryLabel: weakestLabel,
      weakestCategoryScore: weakestScore,
    }
  }

  return {
    product,
    eligible: true,
    reason: 'Available now — all linked areas are strong enough to scope this work.',
    weakestCategoryId: weakestId,
    weakestCategoryLabel: weakestLabel,
    weakestCategoryScore: weakestScore,
  }
}

export function buildQuote(
  evaluation: Evaluation,
  score: EvaluationScore,
  params: BusinessParameters,
  catalog: Product[],
  now: Date = new Date(),
): Quote {
  const issuedAt = now.toISOString()
  const validUntil = addDays(issuedAt, params.quoteValidDays)
  const categories = new Map(score.categories.map((c) => [c.id, c]))
  const entryBlocked = score.overall < params.minOverallToQuote

  const lines = catalog.map((product) =>
    buildLine(product, categories, entryBlocked, score.overall, params),
  )

  const subtotal = round2(
    lines.filter((l) => l.eligible).reduce((sum, l) => sum + l.product.price, 0),
  )

  const tier = tierFor(score.overall, params.tiers)
  const discount = round2((subtotal * tier.discountPct) / 100)
  const eligible = lines.filter((l) => l.eligible)
  const parallelism = parallelismOf(params)

  return {
    number: quoteNumber(evaluation.id, issuedAt),
    lines,
    subtotal,
    discount,
    total: round2(subtotal - discount),
    currency: params.currency,
    tier,
    overall: score.overall,
    eligibleCount: eligible.length,
    lockedCount: lines.length - eligible.length,
    issuedAt,
    validUntil,
    isExpired: false,
    sequentialWeeks: sequentialWeeks(eligible.map((l) => l.product.durationWeeks)),
    parallelWeeks: parallelWeeks(eligible.map((l) => l.product.durationWeeks), parallelism),
    parallelism,
  }
}

/** Running the work one service after another. */
export function sequentialWeeks(durations: number[]): number {
  return durations.reduce((sum, d) => sum + (Number.isFinite(d) && d > 0 ? d : 0), 0)
}

/**
 * Duration when services are packed into `parallelism` concurrent streams.
 *
 * Longest-processing-time packing: take the longest service first and place it
 * in whichever stream is currently least loaded, then repeat. The result is the
 * busiest stream. This is an honest estimate rather than an optimistic one —
 * a single 12-week engagement cannot be compressed by running other work beside
 * it, which is exactly the sort of thing a naive `total / parallelism` would
 * get wrong.
 */
export function parallelWeeks(durations: number[], parallelism: number): number {
  const lanes = Math.max(1, Math.floor(Number.isFinite(parallelism) ? parallelism : 1))
  const jobs = durations
    .filter((d) => Number.isFinite(d) && d > 0)
    .slice()
    .sort((a, b) => b - a)
  if (jobs.length === 0) return 0

  const loads = new Array<number>(lanes).fill(0)
  for (const d of jobs) {
    let target = 0
    for (let i = 1; i < lanes; i++) {
      if (loads[i] < loads[target]) target = i
    }
    loads[target] += d
  }
  return Math.max(...loads)
}

/**
 * Turn a live quote into a frozen, numbered proposal.
 *
 * The snapshot captures the numbers at the moment of freezing so the price
 * cannot drift if answers change afterwards. It deliberately reuses the
 * quote's own clock (issuedAt / validUntil / number) rather than starting a
 * new one — you are freezing what is on screen, not issuing a fresh quote.
 *
 * The evaluation's `updatedAt` is stored so staleness can be judged on whether
 * the *answers* moved, not on whether the clock did.
 */
export function freezeQuote(quote: Quote, evaluation: Evaluation): QuoteSnapshot {
  return {
    number: quote.number,
    evaluationId: evaluation.id,
    evaluationUpdatedAt: evaluation.updatedAt,
    issuedAt: quote.issuedAt,
    validUntil: quote.validUntil,
    currency: quote.currency,
    tierName: quote.tier.name,
    tierDiscountPct: quote.tier.discountPct,
    overall: quote.overall,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    sequentialWeeks: quote.sequentialWeeks,
    parallelWeeks: quote.parallelWeeks,
    parallelism: quote.parallelism,
    // Locked lines are carried through too, marked with the condition that
    // unlocks them. Dropping them would contradict the live quote, where a
    // locked line is always shown — a proposal that silently omits work reads
    // as either a mistake or a judgement on the client.
    lines: quote.lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      summary: l.product.summary,
      price: l.product.price,
      durationWeeks: l.product.durationWeeks,
      deliverables: l.product.deliverables.slice(),
      eligible: l.eligible,
      unlockReason: l.eligible ? undefined : l.reason,
    })),
  }
}

export function isQuoteExpired(snapshot: { validUntil: string }, now: Date = new Date()): boolean {
  return new Date(snapshot.validUntil).getTime() < now.getTime()
}

/**
 * True when the evaluation has been edited since the quotation was issued.
 *
 * The frozen price is deliberately preserved rather than recomputed — a
 * client may already hold it — but the UI must say so rather than imply the
 * number still reflects the current answers.
 *
 * Compares `updatedAt` for equality against the value captured at freeze time
 * rather than against `issuedAt`. An `>` comparison against a wall clock would
 * report a just-frozen quote as stale, because saving the quote itself moves
 * `updatedAt` a few milliseconds past `issuedAt`.
 */
export function isQuoteStale(
  snapshot: QuoteSnapshot,
  evaluation: Evaluation,
): boolean {
  return evaluation.updatedAt !== snapshot.evaluationUpdatedAt
}

/** ISO timestamp `validUntil` minus a small buffer, for human-readable expiry. */
export function expiryNotice(validUntil: string, now: Date = new Date()): string {
  const ms = new Date(validUntil).getTime() - now.getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'This quotation has expired.'
  if (days === 1) return 'Valid for 1 more day.'
  return 'Valid for ' + days + ' more days.'
}

export function touchQuoteExpiry(quote: Quote, now: Date = new Date()): Quote {
  return { ...quote, isExpired: isQuoteExpired({ validUntil: quote.validUntil }, now) }
}
