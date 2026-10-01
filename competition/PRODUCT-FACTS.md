# Product Facts — the single source of truth for competition claims

**Read this before writing any slide, script, or portal text.**

Every number here was read from the shipped code on 2026-10-01. If a claim
about the product is not in this file, it is not verified. If code and this file
disagree, the code wins and this file is the bug.

> **Scope of the entry: the React app in `app/`.** The legacy vanilla-JS app at
> the repo root is a *different product* and is not the submission. See
> "Two apps" below before you describe anything.

> **Authoring boundary.** Per the competition handbook, AI must not write the
> business plan, video, or slides. This file is factual reference material. Every
> sentence that reaches a slide must be written by the participant.

## Settled decisions (2026-10-01)

- **Title** — `On-Device Business Self-Evaluation Tool` (39/50). The "On-Device
  AI" wording is removed; this was the entry's only false claim. Confirm the
  portal shows the corrected string before submitting.
- **Theme** — `Automation & Data Driven Insights`. Defensible on non-AI grounds:
  a weighted score from 40 inputs, category benchmarks, ranked improvements,
  trend comparison.
- **Initiative** — `Tech and Digital Services`. An accurate description of the
  product, and it replaces *New Technologies — Generative AI Solutions*, which
  the guide defines by AI involvement.
- **No AI claim anywhere** — title, theme, initiative, script, video.
- **Pricing** — deliberately **configurable per licensee**, with no committed
  peso figure. This is a real capability, not a gap: the rate card is editable
  per deployer (`app/src/lib/ratecard.ts`). It follows that **no peso prices or
  quotation figures appear in the pitch** and the costs slide is skipped.
- **Market** — Central Visayas, **Cebu Island** as the launch beachhead.

---

## 1. What it is

A browser-only business self-assessment tool. No account, no backend, no install.
A business owner answers **40 Likert-scale (1–5) questions** across **10 weighted
categories**; the app computes a weighted **0–100 score**, classifies it into one
of four bands, and produces a tailored action plan — risks, mitigations, and a
30/90-day roadmap. Answers auto-save to the browser on every keystroke, so a
refresh is never a data loss event.

Everything is computed client-side. No business data is transmitted anywhere.

## 1a. Market scope (for the Market Size slide)

**Central Visayas, with Cebu Island as the launch beachhead.**

- **87,986 MSMEs** in Central Visayas (Region VII) — 99.46% of the region's
  88,468 establishments. *(PSA 2023 List of Establishments, via DTI's 2023
  Philippine MSME Statistics in Brief.)*
- MSME employment in the region: 497,774, 59.96% of 830,195.
- Growth: 80,172 (2022) → 88,468 (2023) establishments, **+10.4% in one year.**
- **40 DTI Negosyo Centers operate in Cebu** — the 40th opened in Cebu City in
  May 2026 as a DTI / Cebu City Government partnership. This is the
  distribution channel, and it is real and current.
- A precise **Cebu-Island-only** MSME count is not in the public regional
  tables. It is in PSA's provincial List of Establishments releases (PSA RSSO 7,
  Cebu City). **Do not estimate it.**

Two different regional figures circulate and must not be conflated:
**87,986** is the PSA establishment register; **50,752** (2024, up from 41,164)
is DTI-*assisted* registrations, a smaller universe. Use 87,986 as market size.

Full detail and sources in `MSME-RESEARCH.md` §1.

## 2. The 10 categories and their weights

Weights sum to 100%. Source: `app/src/lib/scoring.ts` (`CATEGORY_WEIGHTS`).

| Weight | Category id | Displayed label |
| ------ | ----------- | --------------- |
| 14% | `customer-problem` | Customer Problem |
| 14% | `financial-viability` | Financial Viability |
| 12% | `market-opportunity` | Market Opportunity |
| 12% | `value-proposition` | Value Proposition |
| 10% | `operational-feasibility` | Operational Feasibility |
| 10% | `risk-resilience` | Risk and Business Resilience |
| 8% | `competitive-advantage` | Competitive Advantage |
| 8% | `scalability-growth` | Scalability and Long-Term Growth |
| 6% | `sustainability` | Sustainability |
| 6% | `founder-readiness` | Founder Readiness |

**The defensible argument:** the two heaviest categories (Customer Problem and
Financial Viability, 14% each) plus Market Opportunity (12%) are 40% of the score
and are the areas most associated with MSME failure in the cited research. The
instrument's weighting is not arbitrary — it is argued from evidence, and that
argument is checkable against this table. See `MSME-RESEARCH.md`.

## 3. Scoring rules (be precise, judges may test this)

- Each answer 1–5 maps to 0–100 points via `(value - 1) / 4 * 100`.
- A category's score is the **mean of its 4 questions**.
- The overall score is the **weighted mean**, rounded to a whole number.
- **Unanswered questions score 0 and remain in the denominator.** Skipping a
  category lowers the score; it can never be used to inflate it. The UI marks
  unanswered questions explicitly.

That last rule is a genuine design choice and one of the strongest honesty
points in the product. It is worth stating plainly: *the score cannot be gamed
by not answering.*

## 4. The four classification bands

Thresholds from `classify()` in `app/src/lib/scoring.ts`.

| Overall score | Band |
| ------------- | ---- |
| below 40 | Early concept requiring validation |
| 40 – 59 | Promising but needs improvement |
| 60 – 79 | Strong concept with manageable gaps |
| 80 and above | Presentation-ready concept requiring continued validation |

Note the deliberate tone: the lowest band says *"early concept,"* not "failure,"
and the top band still asks for continued validation. The product never
adjudicates a business.

## 5. What it outputs

- **Weighted score + band** with per-category breakdown bars
- **Strengths** — the areas scoring well
- **Top improvements** — ranked by weight, so the highest-value fix surfaces first
- **Risk register** — each risk with a paired treatment/mitigation
- **30-day and 90-day plans**, plus a single immediate next action
- **12-slide presentation mode**, printable to PDF, for pitching to a lender,
  investor, or partner
- **JSON and CSV export** of the full evaluation
- **History** — multiple saved evaluations with rename, duplicate, and compare,
  so progress is visible assessment-over-assessment

Source: `app/src/components/ResultsDashboard.tsx`, `PresentationMode.tsx`,
`app/src/lib/io.ts`, `app/src/lib/storage.ts`.

## 6. Engineering claims you can safely make

- **185 automated tests pass across 14 test files** (`npm test` in `app/`,
  verified 2026-10-01). Use **185**, not 114 or 181 — earlier documents said
  both and were wrong.
- TypeScript, React 19, Vite. Typecheck and lint are clean.
- Two runtime dependencies only: `react` and `react-dom`. No UI kit, no chart
  library, no AI SDK, no analytics, no telemetry.
- Ships as a **static site** and as a **desktop app** (Tauri v2, built for
  Windows).
- Works from a static host with **no backend, no database, and no per-user
  running cost**.

**Say "185 automated tests," never "55."** An earlier draft said 55; it was
wrong and an examiner could have caught it.

## 7. Claims you must NOT make

| Do not claim | Why |
| ------------ | --- |
| Any **AI / generative AI / LLM** feature | The submitted app has **no AI of any kind.** Its only dependencies are React and React DOM. The document analyzer exists only in the legacy root app, which is not the submission. |
| "On-device AI", "AI-suggested scores", "AI document analysis" | No such feature is in the submitted app. Claiming it is the single highest-risk error available — see `AI-ANALYZER-DECISION.md`. |
| "Uploads a document" / "reads your financials" | There is no upload, no document parsing, and no file reading in the React app. |
| Any **price, quote, or peso figure** | The quotation feature exists in the code but is **deliberately held out of the entry** — its rate card is placeholder pricing. See "Quotation feature" below. |
| "8 categories" | The legacy app has 8. The submitted app has **10.** |
| "Strength / Opportunity / Weakness" bands | That is the legacy app's per-category banding. The submitted app has **4 overall bands** (section 4). |
| "Validated by users", "pilot tested", "X businesses use it" | No user testing has been run. Do not imply adoption that does not exist. |
| "DTI partners with us" / "Negosyo Centers use it" | The 40 Cebu Centers are a **channel, not a partner.** No agreement, license, or pilot exists. |
| A Cebu-Island-specific MSME count | Only regional figures are public. Get the provincial table or state the regional number — do not invent one. |
| Any revenue, sales, or customer figures | None exist. |

## 8. Two apps — do not mix them

This repository contains **two different applications**. The confusion between
them is the source of every stale claim in earlier drafts.

| | **React app (`app/`)** — THE SUBMISSION | Legacy app (repo root) |
| --- | --- | --- |
| Categories | **10** | 8 |
| Category names | Customer Problem, Market Opportunity, Value Proposition, Competitive Advantage, Operational Feasibility, Financial Viability, Risk and Business Resilience, Sustainability, Scalability and Long-Term Growth, Founder Readiness | Business Direction, Customers & Market, Financial Health, Operations, People & Leadership, Technology & Security, Risk & Business Continuity, Innovation & Growth |
| Questions | 40 (10 × 4) | 40 (8 × 5) |
| Scoring | weighted, overall 0–100 | unweighted per-category, `SCORE_BANDS` at 2.5 / 3.8 |
| Bands | 4 overall bands | per-category Strength / Opportunity / Weakness |
| AI analyzer | **none** | yes (wllama, Qwen2.5-1.5B GGUF) |
| Quotation engine | yes (held out of entry) | no |

Both have 40 questions, which is why the mistake is easy to miss. The category
*names* differ completely — they are not a subset of each other. If you are ever
unsure which app a claim describes, name the app.

## 9. Quotation feature — internal only, for now

The React app can price services in PHP against a linked rate card. It is real,
tested, and it is **not part of the competition entry**, because the shipped
prices in `app/src/lib/catalog.ts` are placeholders and the product has no users
to quote for.

It is the natural **phase-two** of the venture: the same instrument that scores
an idea, then prices the work to close the gaps. Worth naming as a roadmap item,
never as a current capability with numbers attached.

## 10. Known open items (do not present as resolved)

- `api/src/validate.js` hardcodes `REQUIRED_CATEGORY_COUNT = 8` while the React
  app has 10. The API is a **gated, undeployed** Phase-1 service wired to the
  legacy app; the React app never calls it. **This is documented and intended,
  not a live bug** — see the header comment in `validate.js`.
- Placeholder prices remain in `catalog.ts` by design while the feature is out
  of scope.
- `SECURITY_REVIEW.md` notes the `app/` folder was not reviewed in depth. The app
  holds no secrets and sends nothing anywhere, but do not claim a security audit
  of the React app.
- No Cebu-Island-specific MSME figure, and no user testing. Both are stated as
  open rather than filled with estimates.
