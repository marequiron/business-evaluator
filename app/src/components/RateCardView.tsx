import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Product } from '../lib/catalog'
import { formatMoney } from '../lib/money'
import { categoryById } from '../lib/questions'
import {
  isRateCardCustomised,
  isRateCardValid,
  validateRateCard,
} from '../lib/ratecard'
import type { RateCard, RateCardErrorKey } from '../lib/ratecard'

interface Props {
  card: RateCard
  customised: boolean
  onSave: (card: RateCard) => void
  onReset: () => void
  onBack: () => void
}

/**
 * Reads a numeric field. An empty box is NaN, not 0 — `Number('')` is 0, which
 * would quietly turn a cleared price into a free service. NaN lets validation
 * report the field instead of saving a wrong number.
 */
function numberFrom(e: ChangeEvent<HTMLInputElement>): number {
  if (e.target.value.trim() === '') return Number.NaN
  const n = Number(e.target.value)
  return Number.isFinite(n) ? n : Number.NaN
}

export function RateCardView({ card, customised, onSave, onReset, onBack }: Props) {
  const [draft, setDraft] = useState<RateCard>(card)
  const [syncedFrom, setSyncedFrom] = useState<RateCard>(card)
  const [attempted, setAttempted] = useState(false)

  // Adopt an externally changed card (a save landing, or a reset) by adjusting
  // state during render, which is the supported way to mirror a prop change
  // without an effect that would also clobber in-progress edits.
  if (card !== syncedFrom) {
    setSyncedFrom(card)
    setDraft(card)
    setAttempted(false)
  }

  const errors = useMemo(() => validateRateCard(draft), [draft])
  const hasErrors = Object.keys(errors).length > 0
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(card), [draft, card])

  function updateProduct(id: string, patch: Partial<Product>): void {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  function updateParams(patch: Partial<RateCard['params']>): void {
    setDraft((prev) => ({ ...prev, params: { ...prev.params, ...patch } }))
  }

  function updateTier(id: string, patch: { minOverall?: number; discountPct?: number }): void {
    setDraft((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        tiers: prev.params.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }))
  }

  function handleSubmit(e: { preventDefault: () => void }): void {
    e.preventDefault()
    setAttempted(true)
    if (hasErrors || !isRateCardValid(draft)) return
    onSave(draft)
    setAttempted(false)
  }

  function handleDiscard(): void {
    setDraft(card)
    setAttempted(false)
  }

  const show = (key: RateCardErrorKey): string | undefined =>
    attempted ? errors[key] : undefined

  return (
    <section aria-labelledby="ratecard-title">
      <div className="page-head">
        <div>
          <p className="kicker">Settings</p>
          <h1 id="ratecard-title">Rate card</h1>
          <p className="muted">
            The prices, wording and thresholds every quotation is built from. Changes apply to new
            quotes and to live calculations straight away.
          </p>
        </div>
      </div>

      <p className="quote-flag" role="note">
        Frozen proposals keep the figures they were issued with. Editing the rate card never
        rewrites a quotation that has already gone to a client.
      </p>

      {!isRateCardCustomised(card) ? (
        <p className="hint">
          You are on the shipped default rate card. Anything you change here is stored in this
          browser only.
        </p>
      ) : null}

      <form onSubmit={handleSubmit}>
        <h2 className="section-title">Quotation rules</h2>
        <div className="rc-params card">
          <NumberField
            id="rc-entry"
            label="Entry score"
            help="Nothing is priced below this overall score."
            value={draft.params.minOverallToQuote}
            error={show('params.minOverallToQuote')}
            onChange={(n) => updateParams({ minOverallToQuote: n })}
          />
          <NumberField
            id="rc-valid"
            label="Validity (days)"
            help="How long a frozen quotation stays valid."
            value={draft.params.quoteValidDays}
            error={show('params.quoteValidDays')}
            onChange={(n) => updateParams({ quoteValidDays: n })}
          />
          <NumberField
            id="rc-parallelism"
            label="Services running at once"
            help="Used only for the parallel timeline estimate. It does not change any price."
            value={draft.params.parallelism}
            error={show('params.parallelism')}
            onChange={(n) => updateParams({ parallelism: n })}
          />
        </div>

        <h2 className="section-title">Discount tiers</h2>
        <div className="card">
          <table className="rc-table">
            <caption className="sr-only">Discount tiers</caption>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">From score</th>
                <th scope="col">Discount %</th>
              </tr>
            </thead>
            <tbody>
              {draft.params.tiers.map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.name}</th>
                  <td>
                    <NumberInput
                      id={'rc-tier-' + t.id + '-min'}
                      value={t.minOverall}
                      error={show(`tier.${t.id}.minOverall`)}
                      onChange={(n) => updateTier(t.id, { minOverall: n })}
                    />
                  </td>
                  <td>
                    <NumberInput
                      id={'rc-tier-' + t.id + '-pct'}
                      value={t.discountPct}
                      error={show(`tier.${t.id}.discountPct`)}
                      onChange={(n) => updateTier(t.id, { discountPct: n })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            A higher score earns a bigger reduction. On a quotation this reads as a list price
            with the discount struck through.
          </p>
        </div>

        <h2 className="section-title">Services</h2>
        {draft.products.map((p) => (
          <ProductEditor
            key={p.id}
            product={p}
            errors={{ show, hasErrors }}
            onChange={(patch) => updateProduct(p.id, patch)}
          />
        ))}

        {attempted && hasErrors ? (
          <p className="form-summary-error" role="alert">
            Please fix the highlighted fields before saving.
          </p>
        ) : null}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="ghost"
            onClick={handleDiscard}
            disabled={!dirty}
            aria-disabled={!dirty}
          >
            Discard changes
          </button>
          {customised ? (
            <button type="button" className="danger" onClick={onReset}>
              Reset to defaults
            </button>
          ) : null}
          <button type="submit" className="primary">
            Save rate card
          </button>
        </div>

        <p className="hint" role="status">
          {dirty ? 'You have unsaved changes.' : 'Saved. Quotations use these values.'}
        </p>
      </form>
    </section>
  )
}

function ProductEditor({
  product,
  errors,
  onChange,
}: {
  product: Product
  errors: { show: (k: RateCardErrorKey) => string | undefined; hasErrors: boolean }
  onChange: (patch: Partial<Product>) => void
}) {
  const [open, setOpen] = useState(false)
  const [deliverableText, setDeliverableText] = useState(product.deliverables.join('\n'))
  const [syncedDeliverables, setSyncedDeliverables] = useState(product.deliverables.join('\n'))

  // The textarea keeps its own raw text so a trailing newline can be typed
  // while a line is being written; the product only ever stores non-empty ones.
  if (product.deliverables.join('\n') !== syncedDeliverables) {
    const next = product.deliverables.join('\n')
    setSyncedDeliverables(next)
    setDeliverableText(next)
  }

  const nameError = errors.show(`product.${product.id}.name`)

  return (
    <div className="card rc-product">
      <button
        type="button"
        className="rc-product-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={'rc-product-' + product.id}
      >
        <span className="rc-product-head">
          <span className="rc-product-name">{product.name || 'Untitled service'}</span>
          <span className="rc-product-price">{formatMoney(product.price)}</span>
        </span>
        <span className="rc-product-meta">
          {product.durationWeeks} {product.durationWeeks === 1 ? 'week' : 'weeks'} · unlocks at{' '}
          {product.minCategory} · {product.categoryIds.map((id) => categoryById(id)?.label ?? id).join(', ')}
        </span>
      </button>

      {open ? (
        <div
          className="rc-product-body"
          id={'rc-product-' + product.id}
          role="region"
          aria-label={product.name || 'Untitled service'}
        >
          <div className="field">
            <label htmlFor={'rc-' + product.id + '-name'}>Service name</label>
            <input
              id={'rc-' + product.id + '-name'}
              type="text"
              value={product.name}
              onChange={(e) => onChange({ name: e.target.value })}
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? (
              <p className="field-error" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={'rc-' + product.id + '-summary'}>One-line summary</label>
            <p className="hint" id={'rc-' + product.id + '-summary-help'}>
              Appears on the quotation itself.
            </p>
            <textarea
              id={'rc-' + product.id + '-summary'}
              rows={2}
              value={product.summary}
              aria-describedby={'rc-' + product.id + '-summary-help'}
              onChange={(e) => onChange({ summary: e.target.value })}
            />
          </div>

          <div className="rc-product-numbers">
            <NumberField
              id={'rc-' + product.id + '-price'}
              label="List price (PHP)"
              help="What the client sees before any tier discount."
              value={product.price}
              error={errors.show(`product.${product.id}.price`)}
              onChange={(n) => onChange({ price: n })}
            />
            <NumberField
              id={'rc-' + product.id + '-weeks'}
              label="Duration (weeks)"
              value={product.durationWeeks}
              error={errors.show(`product.${product.id}.durationWeeks`)}
              onChange={(n) => onChange({ durationWeeks: n })}
            />
            <NumberField
              id={'rc-' + product.id + '-min'}
              label="Unlocks at score"
              help="Every linked area must reach this."
              value={product.minCategory}
              error={errors.show(`product.${product.id}.minCategory`)}
              onChange={(n) => onChange({ minCategory: n })}
            />
          </div>

          <div className="field">
            <label htmlFor={'rc-' + product.id + '-deliverables'}>Deliverables</label>
            <p className="hint" id={'rc-' + product.id + '-deliverables-help'}>
              One per line.
            </p>
            <textarea
              id={'rc-' + product.id + '-deliverables'}
              rows={4}
              value={deliverableText}
              aria-describedby={'rc-' + product.id + '-deliverables-help'}
              onChange={(e) => {
                setDeliverableText(e.target.value)
                onChange({
                  deliverables: e.target.value
                    .split('\n')
                    .map((d) => d.trim())
                    .filter((d) => d.length > 0),
                })
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  help,
  error,
  onChange,
}: {
  id: string
  label: string
  value: number
  help?: string
  error?: string
  onChange: (n: number) => void
}) {
  const helpId = help ? id + '-help' : undefined
  const errorId = error ? id + '-error' : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help ? (
        <p className="hint" id={helpId}>
          {help}
        </p>
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => onChange(numberFrom(e))}
        aria-invalid={Boolean(error)}
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
      />
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function NumberInput({
  id,
  value,
  error,
  onChange,
}: {
  id: string
  value: number
  error?: string
  onChange: (n: number) => void
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={Number.isFinite(value) ? String(value) : ''}
      onChange={(e) => onChange(numberFrom(e))}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? id + '-error' : undefined}
      className={error ? 'field-invalid' : undefined}
    />
  )
}
