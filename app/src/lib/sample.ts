import type { Evaluation, Profile } from '../types'
import { newEvaluation } from './storage'

export const SAMPLE_NAME = 'SAMPLE — FreshNest Meal Kits'

export const SAMPLE_PROFILE: Profile = {
  businessName: 'FreshNest Meal Kits',
  businessDescription:
    'A weekly subscription selling pre-portioned meal kits built around seasonal produce from regional farms.',
  problemSolved:
    'Busy families waste groceries and default to unhealthy convenience food because weeknight meal planning and prep take too much time.',
  productService:
    'Pre-portioned, farm-sourced recipe kits delivered weekly with 20-minute cooking instructions and digital pantry lists.',
  targetCustomers: 'Working families with children, ages 28 to 50, living in the metro area who value health and convenience.',
  geographicMarket: 'The city and suburbs within 40 minutes of the central kitchen.',
  revenueModel:
    '₱1,400 per week per subscriber (two meals), optional add-ons, and a refer-a-friend credit. Target 60% gross margin at full volume.',
  startupCost: '250000',
  shortTermObjective: 'Sign 150 recurring subscribers and reach 80% on-time delivery within the first six months.',
  longTermVision:
    'Become the region\u2019s most trusted local meal-kit brand and expand to at least two more cities by year five.',
}

/*
 * Sample answers.
 *
 * Calibrated to score in the low 60s so the sample lands on the Growth tier.
 * That is deliberate: on the Foundation tier the discount is 0%, the list
 * price is not struck through, and the whole point of the pricing treatment is
 * invisible. `sample.test.ts` pins the resulting score, tier and lock count so
 * a change to the catalog cannot quietly move them.
 *
 * `scalability-growth` is held down on purpose so Operations Blueprint stays
 * the one locked service. A sample where everything unlocks teaches nothing
 * about how the gate works.
 */
const strongAnswers: Record<string, number> = {
  'customer-problem__0': 5,
  'customer-problem__1': 5,
  'customer-problem__2': 4,
  'customer-problem__3': 4,
  'market-opportunity__0': 4,
  'market-opportunity__1': 4,
  'market-opportunity__2': 4,
  'market-opportunity__3': 4,
  'value-proposition__0': 5,
  'value-proposition__1': 5,
  'value-proposition__2': 4,
  'value-proposition__3': 4,
  'competitive-advantage__0': 3,
  'competitive-advantage__1': 3,
  'competitive-advantage__2': 3,
  'competitive-advantage__3': 2,
  'operational-feasibility__0': 4,
  'operational-feasibility__1': 3,
  'operational-feasibility__2': 3,
  'operational-feasibility__3': 3,
  'financial-viability__0': 4,
  'financial-viability__1': 4,
  'financial-viability__2': 3,
  'financial-viability__3': 3,
  'risk-resilience__0': 3,
  'risk-resilience__1': 3,
  'risk-resilience__2': 3,
  'risk-resilience__3': 3,
  'sustainability__0': 4,
  'sustainability__1': 4,
  'sustainability__2': 4,
  'sustainability__3': 3,
  // Held low on purpose — keeps Operations Blueprint locked.
  'scalability-growth__0': 2,
  'scalability-growth__1': 2,
  'scalability-growth__2': 2,
  'scalability-growth__3': 3,
  'founder-readiness__0': 3,
  'founder-readiness__1': 4,
  'founder-readiness__2': 3,
  'founder-readiness__3': 3,
}

export const SAMPLE_ANSWERS = Object.fromEntries(
  Object.entries(strongAnswers).map(([k, v]) => [k, { value: v, note: '' }]),
)

export function createSampleEvaluation(now = new Date().toISOString()): Evaluation {
  const sample = newEvaluation(SAMPLE_NAME, now)
  return {
    ...sample,
    profile: { ...SAMPLE_PROFILE },
    answers: JSON.parse(JSON.stringify(SAMPLE_ANSWERS)),
  }
}