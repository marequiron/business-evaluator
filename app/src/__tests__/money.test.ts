import { describe, expect, it } from 'vitest'
import {
  CURRENCY,
  LOCALE,
  currencySymbol,
  formatMoney,
  formatMoneyCompact,
  parseMoney,
} from '../lib/money'

describe('money', () => {
  it('is denominated in Philippine pesos', () => {
    expect(CURRENCY).toBe('PHP')
    expect(LOCALE).toBe('en-PH')
    expect(currencySymbol()).toBe('₱')
  })

  it('formats whole peso amounts without decimals', () => {
    expect(formatMoney(45000)).toBe('₱45,000')
    expect(formatMoney(0)).toBe('₱0')
    expect(formatMoney(1250000)).toBe('₱1,250,000')
  })

  it('formats negatives and non-finite input safely', () => {
    expect(formatMoney(-4500)).toContain('4,500')
    expect(formatMoney(Number.NaN)).toBe('—')
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('honours an explicit fraction digit count', () => {
    expect(formatMoney(1200.5, 2)).toContain('1,200.50')
  })

  it('compacts large amounts but leaves small ones exact', () => {
    expect(formatMoneyCompact(450)).toBe('₱450')
    expect(formatMoneyCompact(45000)).toContain('45')
    expect(formatMoneyCompact(45000).length).toBeLessThan(formatMoney(45000).length)
  })

  it('parses bare, grouped, and decimal amounts', () => {
    expect(parseMoney('25000')).toBe(25000)
    expect(parseMoney('25,000')).toBe(25000)
    expect(parseMoney('1,250,000')).toBe(1250000)
    expect(parseMoney('0')).toBe(0)
    expect(parseMoney('  45000  ')).toBe(45000)
    expect(parseMoney('25000.5')).toBe(25000.5)
  })

  it('accepts peso, other currency symbols, and ISO codes', () => {
    expect(parseMoney('₱45,000')).toBe(45000)
    expect(parseMoney('PHP 60000')).toBe(60000)
    expect(parseMoney('60000php')).toBe(60000)
    expect(parseMoney('₱1,250,000.75')).toBe(1250000.75)
  })

  it('accepts foreign symbols pasted from other tools', () => {
    expect(parseMoney('€12500')).toBe(12500)
    expect(parseMoney('$1,200.50')).toBe(1200.5)
  })

  it('keeps the sign so callers can reject negative values', () => {
    expect(parseMoney('-500')).toBe(-500)
    expect(parseMoney('+2500')).toBe(2500)
  })

  it('rejects input that is not a recognisable money amount', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('lots of money')).toBeNull()
    expect(parseMoney('1.2.3')).toBeNull()
    expect(parseMoney('1,50,000')).toBeNull()
    expect(parseMoney('25000 30000')).toBeNull()
    expect(parseMoney('.5')).toBeNull()
  })
})
