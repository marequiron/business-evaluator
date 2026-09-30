import { useMemo, useState } from 'react'
import type { Evaluation, QuoteSnapshot } from '../types'
import type { BusinessParameters, Product } from '../lib/catalog'
import { formatMoney } from '../lib/money'
import { categoryById } from '../lib/questions'
import {
  buildQuote,
  expiryNotice,
  freezeQuote,
  isQuoteExpired,
  isQuoteStale,
} from '../lib/quote'
import type { Quote, QuoteLine } from '../lib/quote'
import { computeScore } from '../lib/scoring'

interface Props {
  evaluation: Evaluation
  params: BusinessParameters
  catalog: Product[]
  onFreeze: (snapshot: QuoteSnapshot) => void
  onClearFreeze: () => void
  onBack: () => void
  onPrint: () => void
  onExportCsv: (quote: Quote) => void
  onExportJson: () => void
}

export function QuoteView({
  evaluation,
  params,
  catalog,
  onFreeze,
  onClearFreeze,
  onBack,
  onPrint,
  onExportCsv,
  onExportJson,
}: Props) {
  const [now] = useState(() => new Date())
  const score = useMemo(() => computeScore(evaluation.answers), [evaluation.answers])
  const quote = useMemo(
    () => buildQuote(evaluation, score, params, catalog, now),
    [evaluation, score, params, catalog, now],
  )

  const snapshot = evaluation.quoteSnapshot
  const snapshotExpired = snapshot ? isQuoteExpired(snapshot, now) : false
  const snapshotStale = snapshot ? isQuoteStale(snapshot, evaluation) : false
  const businessName = evaluation.profile.businessName || evaluation.name
  const showingSnapshot = Boolean(snapshot)

  return (
    <section aria-labelledby="quote-title">
      <div id="report-root">
        <div className="page-head">
          <div>
            <p className="kicker">Quotation</p>
            <h1 id="quote-title">{businessName}</h1>
            <p className="muted">
              {showingSnapshot ? (
                <>
                  Frozen proposal <strong>{snapshot?.number}</strong> issued{' '}
                  {formatDate(snapshot?.issuedAt)}.
                </>
              ) : (
                'Live quote, recalculated from your current answers.'
              )}
            </p>
          </div>
        </div>

        {snapshotStale ? (
          <p className="quote-flag quote-flag-warn" role="status">
            Your answers have changed since this quotation was issued. The figures below are the
            ones that were frozen — re-freeze to price the current answers.
          </p>
        ) : null}

        {snapshotExpired ? (
          <p className="quote-flag quote-flag-warn" role="status">
            This quotation expired on {formatDate(snapshot?.validUntil)}. Re-freeze for current
            pricing.
          </p>
        ) : null}

        {showingSnapshot ? (
          <FrozenPanel
            snapshot={snapshot!}
            now={now}
            onClear={onClearFreeze}
            onPrint={onPrint}
            onExportJson={onExportJson}
          />
        ) : (
          <LivePanel
            quote={quote}
            now={now}
            onFreeze={() =>
              // Rebuild against the current clock so the proposal is issued on
              // the date it was actually frozen, not the date this view opened.
              onFreeze(
                freezeQuote(
                  buildQuote(evaluation, score, params, catalog, new Date()),
                  evaluation,
                ),
              )
            }
            onPrint={onPrint}
            onExportCsv={onExportCsv}
          />
        )}
      </div>

      <div className="results-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back to results
        </button>
      </div>
    </section>
  )
}

function LivePanel({
  quote,
  now,
  onFreeze,
  onPrint,
  onExportCsv,
}: {
  quote: Quote
  now: Date
  onFreeze: () => void
  onPrint: () => void
  onExportCsv: (quote: Quote) => void
}) {
  return (
    <>
      <div className="quote-summary card">
        <div className="quote-summary-item">
          <span className="quote-summary-label">Overall score</span>
          <span className="quote-summary-value">{quote.overall}/100</span>
        </div>
        <div className="quote-summary-item">
          <span className="quote-summary-label">Tier</span>
          <span className="quote-summary-value">{quote.tier.name}</span>
        </div>
        <div className="quote-summary-item">
          <span className="quote-summary-label">Available now</span>
          <span className="quote-summary-value">{quote.eligibleCount} of {quote.lines.length}</span>
        </div>
        <div className="quote-summary-item">
          <span className="quote-summary-label">
            {quote.discount > 0 ? 'Total (after ' + quote.tier.discountPct + '% off)' : 'Quotation total'}
          </span>
          <span className="quote-summary-value quote-total">
            {quote.discount > 0 ? (
              <>
                <s className="quote-summary-was">{formatMoney(quote.subtotal)}</s>{' '}
                {formatMoney(quote.total)}
              </>
            ) : (
              formatMoney(quote.total)
            )}
          </span>
        </div>
      </div>

      {quote.lockedCount > 0 ? (
        <p className="quote-flag" role="status">
          {quote.lockedCount} of {quote.lines.length} services are shown but not yet available.
          Each one states the exact score that unlocks it — this is a roadmap, not a rejection.
        </p>
      ) : null}

      <h2 className="section-title">Recommended services</h2>
      <ul className="quote-lines">
        {quote.lines.map((line) => (
          <QuoteLineItem key={line.product.id} line={line} />
        ))}
      </ul>

      <Totals
        subtotal={quote.subtotal}
        discount={quote.discount}
        total={quote.total}
        tierName={quote.tier.name}
        discountPct={quote.tier.discountPct}
      />

      <Timeline
        sequentialWeeks={quote.sequentialWeeks}
        parallelWeeks={quote.parallelWeeks}
        parallelism={quote.parallelism}
      />

      <p className="hint">
        {expiryNotice(quote.validUntil, now)} Freeze it to issue a numbered proposal.
      </p>

      <div className="quote-disclaimer">
        <h2 className="section-title">Terms</h2>
        <p>
          This is an estimate, not a binding offer. Figures are in Philippine pesos and exclude
          government taxes, statutory contributions and third-party pass-through costs. Scope is
          confirmed in a signed engagement letter before work begins. Prices may change after the
          validity date.
        </p>
      </div>

      <div className="results-actions">
        {quote.eligibleCount === 0 ? (
          <p className="hint" role="note">
            Nothing to issue yet. Clear the entry gate or a product threshold above and a proposal
            becomes available.
          </p>
        ) : null}
        <button
          type="button"
          className="primary"
          onClick={onFreeze}
          aria-disabled={quote.eligibleCount === 0}
        >
          Freeze into a proposal
        </button>
        <button type="button" className="secondary" onClick={() => onExportCsv(quote)}>
          Export CSV
        </button>
        <button type="button" className="secondary" onClick={onPrint}>
          Save as PDF
        </button>
      </div>
    </>
  )
}

function QuoteLineItem({ line }: { line: QuoteLine }) {
  const { product } = line
  return (
    <li className={line.eligible ? 'quote-line' : 'quote-line quote-line-locked'}>
      <div className="quote-line-head">
        <h3>{product.name}</h3>
        <span className="quote-line-price">{formatMoney(product.price)}</span>
      </div>
      <p className="quote-line-summary">{product.summary}</p>
      <p className="quote-line-meta">
        {product.durationWeeks} {product.durationWeeks === 1 ? 'week' : 'weeks'}
        {' · '}
        Strengthens {product.categoryIds.map(categoryLabel).join(' and ')}
      </p>
      <p
        className={line.eligible ? 'quote-line-state quote-line-state-ok' : 'quote-line-state'}
        aria-disabled={!line.eligible}
      >
        {line.eligible ? 'Available now' : 'Not yet available'} — {line.reason}
      </p>
      <details className="quote-deliverables">
        <summary>What you get</summary>
        <ul className="plain-list">
          {product.deliverables.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </details>
    </li>
  )
}

/**
 * The price block.
 *
 * With a discount the list price is struck through so the reduction is visible
 * rather than buried as a line item. With no discount there is nothing to strike
 * through, so the row is hidden entirely — a crossed-out price beside a 0%
 * reduction reads as a bug.
 */
function Totals({
  subtotal,
  discount,
  total,
  tierName,
  discountPct,
}: {
  subtotal: number
  discount: number
  total: number
  tierName: string
  discountPct: number
}) {
  const hasDiscount = discount > 0
  return (
    <div className="quote-totals card">
      <div className="quote-total-row">
        <span>{hasDiscount ? 'List price' : 'Subtotal'}</span>
        <span className={hasDiscount ? 'quote-list-price' : undefined}>
          {hasDiscount ? <s>{formatMoney(subtotal)}</s> : formatMoney(subtotal)}
        </span>
      </div>
      {hasDiscount ? (
        <div className="quote-total-row quote-total-discount">
          <span>
            {tierName} tier discount ({discountPct}%)
          </span>
          <span>−{formatMoney(discount)}</span>
        </div>
      ) : null}
      <div className="quote-total-row quote-total-grand">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  )
}

/**
 * Both timeline figures, always shown together.
 *
 * The parallel number is an assumption about resourcing, not a commitment, so
 * it is always accompanied by the sequential total and the concurrency used.
 */
function Timeline({
  sequentialWeeks,
  parallelWeeks,
  parallelism,
}: {
  sequentialWeeks: number
  parallelWeeks: number
  parallelism: number
}) {
  if (sequentialWeeks <= 0) return null
  const runsParallel = parallelWeeks < sequentialWeeks
  return (
    <p className="hint">
      {sequentialWeeks} {sequentialWeeks === 1 ? 'week' : 'weeks'} of work in total. Running{' '}
      {parallelism} at a time, roughly {parallelWeeks}{' '}
      {parallelWeeks === 1 ? 'week' : 'weeks'}
      {runsParallel ? ' from start to finish' : ''} depending on availability.
    </p>
  )
}

function FrozenPanel({
  snapshot,
  now,
  onClear,
  onPrint,
  onExportJson,
}: {
  snapshot: QuoteSnapshot
  now: Date
  onClear: () => void
  onPrint: () => void
  onExportJson: () => void
}) {
  // Snapshots taken before locked lines were captured have no `eligible` flag.
  // Those stored only quotable lines, so an absent flag means available.
  const quotedLines = snapshot.lines.filter((l) => l.eligible !== false)
  const lockedLines = snapshot.lines.filter((l) => l.eligible === false)
  return (
    <>
      <div className="quote-snapshot card">
        <div className="quote-total-row">
          <span>Quotation number</span>
          <span>{snapshot.number}</span>
        </div>
        <div className="quote-total-row">
          <span>Issued</span>
          <span>{formatDate(snapshot.issuedAt)}</span>
        </div>
        <div className="quote-total-row">
          <span>Valid until</span>
          <span>{formatDate(snapshot.validUntil)}</span>
        </div>
        <div className="quote-total-row">
          <span>Tier at issue</span>
          <span>{snapshot.tierName}</span>
        </div>
      </div>

      <p className="hint">{expiryNotice(snapshot.validUntil, now)}</p>

      <h2 className="section-title">Quoted services</h2>
      <ul className="quote-lines">
        {quotedLines.map((line) => (
          <li key={line.productId} className="quote-line">
            <div className="quote-line-head">
              <h3>{line.name}</h3>
              <span className="quote-line-price">{formatMoney(line.price)}</span>
            </div>
            <p className="quote-line-summary">{line.summary}</p>
            <p className="quote-line-meta">
              {line.durationWeeks} {line.durationWeeks === 1 ? 'week' : 'weeks'}
            </p>
            <ul className="plain-list">
              {line.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {lockedLines.length > 0 ? (
        <>
          <h2 className="section-title">Available as you progress</h2>
          <p className="hint">
            These are not priced into this proposal yet. Each one is listed with what would make it
            available, so nothing here is a rejection.
          </p>
          <ul className="quote-lines">
            {lockedLines.map((line) => (
              <li key={line.productId} className="quote-line quote-line-locked">
                <div className="quote-line-head">
                  <h3>{line.name}</h3>
                  <span className="quote-line-price">{formatMoney(line.price)}</span>
                </div>
                <p className="quote-line-summary">{line.summary}</p>
                <p className="quote-line-meta">
                  {line.durationWeeks} {line.durationWeeks === 1 ? 'week' : 'weeks'}
                </p>
                <p className="quote-line-state">{line.unlockReason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Totals
        subtotal={snapshot.subtotal}
        discount={snapshot.discount}
        total={snapshot.total}
        tierName={snapshot.tierName}
        discountPct={snapshot.tierDiscountPct}
      />

      <Timeline
        sequentialWeeks={snapshot.sequentialWeeks}
        parallelWeeks={snapshot.parallelWeeks}
        parallelism={snapshot.parallelism}
      />

      <div className="quote-disclaimer">
        <h2 className="section-title">Terms</h2>
        <p>
          This is an estimate, not a binding offer. Figures are in Philippine pesos and exclude
          government taxes, statutory contributions and third-party pass-through costs. Scope is
          confirmed in a signed engagement letter before work begins. Prices may change after the
          validity date.
        </p>
      </div>

      <div className="results-actions">
        <button type="button" className="primary" onClick={onPrint}>
          Save as PDF
        </button>
        <button type="button" className="secondary" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          Unfreeze and recalculate
        </button>
      </div>
    </>
  )
}

function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}
