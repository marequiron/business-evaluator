# Business Evaluator — React app

The active application: a browser-only business self-evaluation tool that scores
a startup idea across **10 weighted categories**, then prices the services needed
to close the gaps.

See `../AGENTS.md` for the full project brief, including the older vanilla-JS
app at the repo root and how the two differ.

## Run it

```bash
npm install
npm run dev        # dev server
npm test           # 114 vitest tests
npm run typecheck  # tsc -b
npm run lint       # oxlint
npm run build      # tsc -b && vite build
npm run preview    # serve the production build
```

## How it works

| Stage | What happens |
| ----- | ------------ |
| Profile | 10 fields describing the idea, including a peso startup-cost figure |
| Wizard | 40 Likert questions (10 categories x 4). Unanswered counts as 0, never skipped |
| Results | Weighted 0-100 score, 4 classification bands, strengths, risks, 30/90-day plan |
| Quotation | Products linked to categories, priced in PHP, with locked items showing their unlock condition |
| Presentation | 12 slides, printable to PDF |

## Layout

- `src/types.ts` — `Profile`, `Answers`, `Evaluation`, `QuoteSnapshot`, `View`
- `src/lib/questions.ts` — the 10 categories and 40 questions (content only)
- `src/lib/scoring.ts` — weights, 1-5 to 0-100 mapping, `classify()`
- `src/lib/recommendations.ts` — strengths, risks, plans, next milestone
- `src/lib/money.ts` — **all** currency handling (PHP / `en-PH`)
- `src/lib/catalog.ts` — **shipped default** product rate card and business
  parameters (not what runs at runtime; see below)
- `src/lib/ratecard.ts` — the live rate card: merge saved overrides onto the
  defaults by id, validate, persist, reset
- `src/lib/quote.ts` — pure quotation engine, entry gate + product gate
- `src/lib/io.ts` — JSON/CSV import-export
- `src/lib/storage.ts` — localStorage persistence
- `src/components/` — one component per view
- `src/index.css` — all styling; design tokens at the top

Pure logic lives in `src/lib/*.ts` with no DOM access, so it is tested directly
without mocks.

## Quotation model

A product is linked to one or more scoring categories. It becomes quotable when
**both** gates pass:

1. **Entry gate** — overall score >= `BUSINESS_PARAMETERS.minOverallToQuote` (40)
2. **Product gate** — every linked category >= that product's `minCategory`

Locked lines are never hidden. They show the exact condition that unlocks them,
because a wall reads as a rejection and a goal reads as work to do. The overall
score also picks a discount tier (Foundation 0% / Growth 5% / Scale 10%).

Quotes are **derived**, rebuilt on every render, so editing an answer updates the
price immediately. "Freeze into a proposal" is optional and explicit: it captures
a numbered, dated snapshot so a price already sent to a client cannot drift.

Staleness is measured against the evaluation's `updatedAt` **as captured at
freeze time**, not against a wall clock. Attaching the quote is a metadata save
(`upsertEvaluationMeta`) that deliberately does not move `updatedAt` — otherwise
every newly issued proposal would instantly report itself as stale.

## Editing the rate card

`catalog.ts` is the **shipped default**, not the running configuration. **Rate
card** in the nav opens an editor that writes to this browser only
(`business-evaluator-ratecard-v1`); the nav shows an `edited` badge once you
diverge from the defaults, and you can reset at any time.

You can edit service names, summaries, deliverables, list prices, durations,
unlock thresholds, the entry score, the validity window, how many services run
at once, and each tier's floor and discount. Two things are deliberately not
editable: `categoryIds` (the scoring links are the scoring model, not pricing)
and the currency (PHP everywhere, via `money.ts`).

Saved overrides are merged onto the catalog by **product id** and **tier id**.
That means adding a service or a field in a later release keeps your edits
intact instead of discarding them, and reordering tiers cannot scramble them.
Renaming or deleting a product `id` is a breaking change for existing saves.

## Discount and duration presentation

When a tier discount applies, the list price is struck through with a real `<s>`
element and the reduction is named ("Growth tier discount (5%)"), so the saving
survives print, high-contrast mode, and screen readers instead of being conveyed
by colour alone. At 0% there is nothing to strike and the row stays "Subtotal".

The quotation gives **two** durations: a sequential total, and a parallel
estimate that packs services into `parallelism` concurrent streams
(longest-processing-time, busiest stream wins). The parallel figure is
deliberately pessimistic — a 12-week engagement cannot be compressed by running
something else beside it, which a naive `total / parallelism` would claim. The
assumption is stated next to the number, and it never changes a price.

## Before showing this to anyone

**The prices in `src/lib/catalog.ts` are placeholders.** Replace them with your
real rate card. The entry gate, per-product thresholds, tier discounts, and
validity window are all in `BUSINESS_PARAMETERS` in the same file.

The **Load Sample Idea** answer set is calibrated to land on the Growth tier
(5% off) with exactly one locked service — Operations Blueprint, held back by
scalability. That is deliberate: on the Foundation tier the discount is 0% and
the pricing treatment would be invisible. `src/__tests__/sample.test.ts` pins
the score, tier, and lock count, so a catalog change that quietly moves the demo
fails the build instead of surprising you in a pitch.
