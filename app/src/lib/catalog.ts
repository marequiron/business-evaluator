/*
 * Product catalog and business parameters (content only, no logic).
 *
 * This is the single place where the commercial offer is defined. Everything
 * else in the quotation feature derives from these two structures, so
 * changing a price or a threshold here is all that is needed — no component
 * or engine code has to be touched.
 *
 * This mirrors how `questions.ts` holds the assessment content: static data
 * separated from logic so the content can be edited safely.
 *
 * PRICES ARE PLACEHOLDERS. Replace them with your real rate card before this
 * is shown to anyone outside the team.
 */

export interface Product {
  id: string
  name: string
  /** One line, client-facing. Appears on the quotation itself. */
  summary: string
  /**
   * Which scoring categories this product strengthens. A product is only
   * offered once EVERY category listed here clears its threshold — you
   * cannot sell positioning work while your competitive advantage is still
   * an assumption.
   */
  categoryIds: string[]
  /** Price in pesos, whole units. */
  price: number
  durationWeeks: number
  deliverables: string[]
  /** Every linked category must reach this score (0-100) to unlock. */
  minCategory: number
}

export interface Tier {
  id: string
  name: string
  /** Overall score floor for this tier. */
  minOverall: number
  /** Percentage taken off the eligible subtotal. */
  discountPct: number
}

export interface BusinessParameters {
  currency: 'PHP'
  locale: 'en-PH'
  /**
   * Entry gate. Below this overall score nothing is quoted, because the
   * foundations are not yet solid enough to scope work against. Locked items
   * stay visible with this number as the reason.
   */
  minOverallToQuote: number
  /** How long a frozen quotation stays valid. */
  quoteValidDays: number
  /**
   * How many services the parallel timeline assumes run at the same time.
   * Purely a presentational assumption about resourcing, but it is stated on
   * the quotation so nobody reads the shorter figure as a commitment.
   */
  parallelism: number
  tiers: Tier[]
}

export const BUSINESS_PARAMETERS: BusinessParameters = {
  currency: 'PHP',
  locale: 'en-PH',
  minOverallToQuote: 40,
  quoteValidDays: 30,
  parallelism: 2,
  tiers: [
    { id: 'foundation', name: 'Foundation', minOverall: 40, discountPct: 0 },
    { id: 'growth', name: 'Growth', minOverall: 60, discountPct: 5 },
    { id: 'scale', name: 'Scale', minOverall: 80, discountPct: 10 },
  ],
}

/**
 * The default offer. Eight products, deliberately covering all ten scoring
 * categories so that any evaluation can be quoted against something.
 */
export const PRODUCTS: Product[] = [
  {
    id: 'customer-discovery',
    name: 'Customer Discovery Sprint',
    summary: 'Structured interviews with real prospects to prove the problem is painful and worth paying to solve.',
    categoryIds: ['customer-problem'],
    price: 45000,
    durationWeeks: 3,
    deliverables: [
      'Interview guide and target respondent profile',
      '10 moderated interviews with qualified prospects',
      'Verbatim transcripts and pain-point frequency analysis',
      'Demand findings report with a go / refine / stop recommendation',
    ],
    minCategory: 25,
  },
  {
    id: 'market-sizing',
    name: 'Market Sizing & Competitor Map',
    summary: 'A defensible market size and a map of who you are actually up against.',
    categoryIds: ['market-opportunity'],
    price: 40000,
    durationWeeks: 3,
    deliverables: [
      'TAM, SAM and SOM build with stated assumptions',
      'Competitor teardown across 8 to 10 direct and indirect rivals',
      'Segment attractiveness ranking',
      'Market entry recommendation',
    ],
    minCategory: 25,
  },
  {
    id: 'positioning',
    name: 'Positioning & Message Test',
    summary: 'A single clear position in the market, tested with real buyers before you commit budget to it.',
    categoryIds: ['value-proposition', 'competitive-advantage'],
    price: 55000,
    durationWeeks: 4,
    deliverables: [
      'Value proposition and positioning canvas',
      'Three distinct messaging directions',
      'Message test with target buyers',
      'Final positioning statement and proof points',
    ],
    minCategory: 40,
  },
  {
    id: 'unit-economics',
    name: 'Unit Economics & Pricing Model',
    summary: 'What you actually earn per sale, what it costs to deliver, and where the break-even point sits.',
    categoryIds: ['financial-viability'],
    price: 60000,
    durationWeeks: 4,
    deliverables: [
      'Cost model covering fixed, variable and per-order costs',
      'Contribution margin per product or service line',
      'Pricing structure with three tested tiers',
      'Break-even analysis and 12-month cash projection',
    ],
    minCategory: 30,
  },
  {
    id: 'operations-blueprint',
    name: 'Operations Blueprint',
    summary: 'The repeatable process, toolchain and hiring sequence that make delivery consistent as you grow.',
    categoryIds: ['operational-feasibility', 'scalability-growth'],
    price: 75000,
    durationWeeks: 6,
    deliverables: [
      'End-to-end process map with owners and handoffs',
      'Tool and systems selection with cost comparison',
      'Capacity plan through the first 12 months',
      'Scaling roadmap and hiring sequence',
    ],
    minCategory: 40,
  },
  {
    id: 'risk-compliance',
    name: 'Risk Register & Compliance Setup',
    summary: 'A live register of what could go wrong, what it would cost, and the filings and policies that keep you legal.',
    categoryIds: ['risk-resilience'],
    price: 50000,
    durationWeeks: 3,
    deliverables: [
      'Risk register scored by likelihood and impact',
      'Mitigation and contingency plan for the top risks',
      'Applicable permits, registrations and filing calendar',
      'Core policy templates for your operating context',
    ],
    minCategory: 25,
  },
  {
    id: 'sustainability',
    name: 'Sustainability Baseline',
    summary: 'Measure what you actually use, set a target you can hit, and report it honestly.',
    categoryIds: ['sustainability'],
    price: 35000,
    durationWeeks: 3,
    deliverables: [
      'Baseline measurement across energy, waste and supply chain',
      'Reduction targets with cost and effort per initiative',
      'Prioritised action list with quick wins first',
      'Simple reporting template for ongoing disclosure',
    ],
    minCategory: 20,
  },
  {
    id: 'founder-coaching',
    name: 'Founder Readiness Coaching',
    summary: 'Twelve weeks of structured coaching to close the leadership and decision-making gaps holding the business back.',
    categoryIds: ['founder-readiness'],
    price: 30000,
    durationWeeks: 12,
    deliverables: [
      'Weekly 1:1 coaching sessions over 12 weeks',
      'Decision framework for the recurring hard calls',
      'Personal operating cadence and delegation plan',
      'End-of-programme progress review',
    ],
    minCategory: 35,
  },
]

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
