/*
 * Money helpers (pure, DOM-free).
 *
 * Single source of truth for currency handling. Before this module there were
 * two divergent `formatCost` copies (components/ProfileForm.tsx and
 * components/PresentationMode.tsx) plus a hardcoded USD assumption in each.
 * Everything money-shaped now goes through here.
 *
 * Quotations and the profile's startup cost are both denominated in PHP.
 * Change CURRENCY / LOCALE here to re-denominate the whole app.
 */

export const CURRENCY = 'PHP'
export const LOCALE = 'en-PH'

/*
 * Accepted currency tokens. Deliberately permissive on input: a user pasting
 * "$1,200.50" or "€12500" from another tool should still parse, we just
 * display it in PHP.
 */
const CURRENCY_TOKENS =
  '₱|PHP|php|€|EUR|eur|£|GBP|gbp|\\$|USD|usd|¥|JPY|jpy|₱'

const MONEY_PATTERN = new RegExp(
  '^[-+]?\\s*(?:(?:' +
    CURRENCY_TOKENS +
    ')\\s*)?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*(?:(?:' +
    CURRENCY_TOKENS +
    ')\\s*)?$',
  'iu',
)

/**
 * Parse a user-entered money string into a number.
 * Returns null for anything that is not recognisably a money amount, so
 * callers can show a validation message instead of rendering NaN.
 */
export function parseMoney(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (!MONEY_PATTERN.test(trimmed)) return null
  const n = Number(
    trimmed
      .replace(/[,\s]/gu, '')
      .replace(/^[^\d-]+/u, '')
      .replace(/[^\d]+$/u, ''),
  )
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * Format a number as PHP. Whole peso amounts by default — quotations and the
 * startup cost figure are both headline figures, not accounting lines.
 */
export function formatMoney(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Compact display for dense tables, e.g. 1_250_000 -> ₱1.25M */
export function formatMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) < 1000) return formatMoney(value)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** The bare symbol, e.g. "₱" — used in headings and column labels. */
export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })
    .formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? '₱'
}
