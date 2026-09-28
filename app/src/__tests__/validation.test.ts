import { describe, expect, it } from 'vitest'
import { parseStartupCost, validateProfile } from '../lib/validation'
import { EMPTY_PROFILE } from '../types'
import { SAMPLE_PROFILE } from '../lib/sample'

describe('validation', () => {
  it('flags empty and too-short required fields', () => {
    const result = validateProfile(EMPTY_PROFILE)
    expect(result.valid).toBe(false)
    expect(Object.keys(result.errors).length).toBe(10)
    expect(result.errors.businessName).toContain('required')
    expect(result.errors.businessDescription).toContain('required')
  })

  it('accepts a fully valid profile', () => {
    const result = validateProfile(SAMPLE_PROFILE)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('rejects a non-numeric startup cost', () => {
    const profile = { ...SAMPLE_PROFILE, startupCost: 'lots of money' }
    const result = validateProfile(profile)
    expect(result.valid).toBe(false)
    expect(result.errors.startupCost).toContain('must be a number')
  })

  it('rejects a negative startup cost', () => {
    const profile = { ...SAMPLE_PROFILE, startupCost: '-500' }
    const result = validateProfile(profile)
    expect(result.valid).toBe(false)
    expect(result.errors.startupCost).toContain('negative')
  })

  it('accepts currency-formatted and comma-separated costs', () => {
    expect(parseStartupCost('25,000')).toBe(25000)
    expect(parseStartupCost('€12500')).toBe(12500)
    expect(parseStartupCost('$1,200.50')).toBe(1200.5)
    expect(parseStartupCost('')).toBeNull()
    expect(parseStartupCost('abc')).toBeNull()
  })

  it('reports the first short field with a helpful minimum-length message', () => {
    const profile = { ...SAMPLE_PROFILE, productService: 'ok' }
    const result = validateProfile(profile)
    expect(result.valid).toBe(false)
    expect(result.errors.productService).toContain('at least 5')
  })
})