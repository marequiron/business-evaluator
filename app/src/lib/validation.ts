import type { Profile } from '../types'

export type ProfileErrorKey = keyof Profile

export interface ProfileValidation {
  valid: boolean
  errors: Partial<Record<ProfileErrorKey, string>>
}

function required(value: string, min: number, label: string): string | undefined {
  const length = value.trim().length
  if (length === 0) return label + ' is required.'
  if (length < min) return label + ' needs at least ' + min + ' characters.'
  return undefined
}

export function parseStartupCost(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(/,/g, '').replace(/[$€£¥]/, ''))
  if (Number.isNaN(n)) return null
  return n
}

export function validateProfile(profile: Profile): ProfileValidation {
  const errors: Partial<Record<ProfileErrorKey, string>> = {}

  const nameErr = required(profile.businessName, 2, 'Business name')
  if (nameErr) errors.businessName = nameErr

  const descErr = required(profile.businessDescription, 10, 'Business description')
  if (descErr) errors.businessDescription = descErr

  const problemErr = required(profile.problemSolved, 10, 'Problem being solved')
  if (problemErr) errors.problemSolved = problemErr

  const productErr = required(profile.productService, 5, 'Product or service')
  if (productErr) errors.productService = productErr

  const targetErr = required(profile.targetCustomers, 5, 'Target customers')
  if (targetErr) errors.targetCustomers = targetErr

  const geoErr = required(profile.geographicMarket, 3, 'Geographic market')
  if (geoErr) errors.geographicMarket = geoErr

  const revenueErr = required(profile.revenueModel, 5, 'Revenue model')
  if (revenueErr) errors.revenueModel = revenueErr

  const cost = parseStartupCost(profile.startupCost)
  if (profile.startupCost.trim() === '') {
    errors.startupCost = 'Estimated startup cost is required.'
  } else if (cost == null) {
    errors.startupCost = 'Startup cost must be a number, e.g. 25000.'
  } else if (cost < 0) {
    errors.startupCost = 'Startup cost cannot be negative.'
  }

  const shortErr = required(profile.shortTermObjective, 5, 'Short-term objective')
  if (shortErr) errors.shortTermObjective = shortErr

  const longErr = required(profile.longTermVision, 5, 'Long-term vision')
  if (longErr) errors.longTermVision = longErr

  return { valid: Object.keys(errors).length === 0, errors }
}