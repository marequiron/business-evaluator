export interface Profile {
  businessName: string
  businessDescription: string
  problemSolved: string
  productService: string
  targetCustomers: string
  geographicMarket: string
  revenueModel: string
  startupCost: string
  shortTermObjective: string
  longTermVision: string
}

export const EMPTY_PROFILE: Profile = {
  businessName: '',
  businessDescription: '',
  problemSolved: '',
  productService: '',
  targetCustomers: '',
  geographicMarket: '',
  revenueModel: '',
  startupCost: '',
  shortTermObjective: '',
  longTermVision: '',
}

export interface AnswerValue {
  value: number | null
  note: string
}

export type Answers = Record<string, AnswerValue>

export interface QuoteSnapshotLine {
  productId: string
  name: string
  summary: string
  price: number
  durationWeeks: number
  deliverables: string[]
  /**
   * Whether this line was quotable when the proposal was issued. `undefined` on
   * snapshots written before locked lines were captured; treat those as
   * eligible, since only eligible lines were ever stored then.
   */
  eligible?: boolean
  /**
   * The client-safe condition that unlocks a locked line. Present only when
   * `eligible` is false. A locked line is never dropped from the proposal — it
   * is shown with the work that would make it available.
   */
  unlockReason?: string
}

/**
 * A frozen, numbered proposal. The live quote is always derived from the
 * current answers; this captures the numbers at a point in time so a price
 * sent to a client cannot drift afterwards.
 */
export interface QuoteSnapshot {
  number: string
  evaluationId: string
  /**
   * The evaluation's `updatedAt` at the moment of freezing. Staleness is
   * measured against this rather than `issuedAt` so that attaching the quote
   * itself never counts as an edit to the answers.
   */
  evaluationUpdatedAt: string
  issuedAt: string
  validUntil: string
  currency: string
  tierName: string
  /** Recorded rather than back-computed from `discount / subtotal`. */
  tierDiscountPct: number
  overall: number
  /** List price, before the tier discount. */
  subtotal: number
  discount: number
  total: number
  sequentialWeeks: number
  parallelWeeks: number
  parallelism: number
  lines: QuoteSnapshotLine[]
}

export interface Evaluation {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  profile: Profile
  answers: Answers
  /** Absent until the user explicitly freezes a quotation. */
  quoteSnapshot?: QuoteSnapshot
}

export type View =
  | 'welcome'
  | 'profile'
  | 'wizard'
  | 'results'
  | 'quote'
  | 'presentation'
  | 'manager'
  | 'ratecard'