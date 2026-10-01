# Business Self-Evaluation Tool — Project Instructions for opencode

## What this project is
A single-page web app that lets a business owner answer Likert-scale (1-5)
questions across 8 categories, then automatically classifies each category as
a **Strength**, **Weakness**, or **Opportunity** and shows a tailored
recommendation for it. No backend, no build step, no database — pure static
HTML/CSS/JS so it's easy to run, deploy (e.g., GitHub Pages), and extend.

## Project structure
- `index.html` — page shell, loads `js/data.js` then `js/app.js`. In managed
  deployments it loads `js/managed.js` *before* `js/app.js`, so the sign-in
  gate replaces the shell until the user is onboarded.
- `css/style.css` — all styling. Uses CSS custom properties at the top
  (`--strength`, `--opportunity`, `--weakness`, `--accent`) for the color
  scheme — change these instead of hunting for hex codes elsewhere.
- `js/data.js` — **the content model**. Contains `CATEGORIES` (array of
  category objects: id, label, icon, questions[], recommendations{weakness,
  opportunity, strength}), `SCORE_BANDS` (thresholds that decide which band
  a category's average score falls into), and `SUBMIT_FORM` (Microsoft Form
  link/prefill for the "Submit results" button). Add/edit categories and
  questions here. Also holds `ANALYZE` (on-device analyzer config: provider,
  model repo/file, context size, max input length) and `MANAGED_ACCESS`
  (optional Entra ID sign-in gate config — `enabled` defaults `false`) —
  content/config only, no rendering logic — so no other file needs to change
  for content edits.
- `js/app.js` — rendering + logic. Builds the form from `CATEGORIES`,
  stores answers in `localStorage` (key: `business-evaluator-answers-v1`),
  computes per-category averages, and renders the bar chart (with band
  legend) + grouped result cards. Questions and recommendations show the
  business wording; a ⓘ button opens a plain-language overlay (`createInfoButton`,
  `toggleInfoOverlay`, `#info-overlay`) with the item's `simple` text. Also
  handles the "Export Results" (.txt download) and "Print / Save as PDF"
  (`window.print()` + print stylesheet) buttons, "Submit results" (see
  below), "Reset", and a history/compare panel: evaluating auto-saves a
  snapshot (`business-evaluator-history-v1`, capped at 100) with manual
  save/compare/delete plus JSON export/import.
- `js/managed.js` — the optional sign-in gate (no-op unless
  `MANAGED_ACCESS.enabled`). Checks SWA `/.auth/me`, drives states
  (loading / signed-out / wrong-tenant / expired / first-login / unassigned /
  profile-failure / unavailable / ready), renders a one-time onboarding form
  (display name, language, two consents) against `/api/profile`, offers an
  explicit one-time guest-data import, and a sign-out control. **Never**
  writes identity or tokens to `localStorage`. Exposes `ManagedAccess.init(opts)`
  with injectable `config`/`fetch`/`navigate` for tests.
- `js/analyzer-parse.js` — pure, DOM-free helpers for the optional document
  analyzer: `documentToText()` (txt/md/csv/json → plain text), `truncateDocument()`,
  `buildAnalysisPrompt()`, `parseSuggestions()`. Loaded as a plain `<script>`
  (global `AnalyzerParse`) and `require()`-able in Node for tests.
- `js/analyzer.js` — the analyzer provider abstraction (`createAnalyzer()`):
  `wllama` (on-device, default), `api` (Phase 1 backend, stub), `mock` (tests).
  No rendering. Configured by `ANALYZE` in `js/data.js`.
- `js/vendor/wllama/` — the vendored `@wllama/wllama` engine (MIT): ESM bundle
  + `.wasm` + `LICENCE`. This is the project's **only** runtime dependency,
  committed on purpose (no build step, no runtime CDN). See its `README.txt`
  to update. Model weights are NOT vendored — the browser downloads them once
  from Hugging Face and caches them.
- `test/analyzer.test.js`, `test/app.smoke.test.js`, `test/managed.test.js`,
  `test/localauth.test.js` — plain-Node unit tests, run with `npm test` from
  the repo root.
- `serve.js` — zero-dependency local static server (`npm run local`, default
  port 4173). Serves `.wasm` with the right MIME type; needed by the analyzer.
- `scripts/localauth-lib.js` — shared plumbing for the two no-Azure managed-mode
  demo servers: `serve.js` static delegation, the runtime `js/data.js` rewrite
  (MANAGED_ACCESS on / tenant / guest-import / local submit apiUrl), and
  cookie/json/redirect/body helpers.
- `scripts/mock-swauth.js` — `npm run mock:auth`: persona SWA/Entra simulator
  (http://127.0.0.1:4174/) for every gate state (first-login, ready, reviewer,
  unassigned, wrong-tenant, expired). Cookie `maa_session`; fake profile API.
- `scripts/github-swauth.js` — `npm run auth:github`: local SWA-equivalent that
  **really logs you in via GitHub OAuth**, then runs the **actual** `api/src`
  handlers for `/api/profile` and `/api/submit` (only storage differs — in-memory
  dev store). Identity key = GitHub numeric id; the OAuth token is exchanged once
  and **never** stored. Roles map from the gitignored
  `scripts/github-roles.local.json` (see `github-roles.sample.json`); unmapped
  users get `[]` → the unassigned banner. No `?as=` persona overrides here. OAuth
  credentials: env `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` or the gitignored
  `scripts/.github-oauth.json`. `createGithubServer` + `buildPrincipal` are
  exported so `test/localauth.test.js` drives a real HTTP server with a stubbed
  GitHub transport.
- `staticwebapp.config.example.json` — SWA config template for managed
  deployments (Entra ID provider placeholders, `/api/*` behind the
  `authenticated` role, CSP/HSTS headers, 401/403 response overrides).
- `api/` — Phase 1 service (Azure Functions → Cosmos DB), behind
  an approval gate (see `PHASE-1-PLAN.md`). `src/auth.js` (identity + security
  core: principal parsing, role gates, CSRF envelope, tenant check,
  rate limiter, sanitizing auditor), `src/validate.js` (pure payload
  checks), `src/handler.js` (framework-agnostic request logic),
  `src/store.js` (Cosmos + in-memory stores), `src/profile-handler.js`
  (onboarding + guest import), `src/functions/submit.js` + `src/functions/profile.js`
  (Azure HTTP adapters), plus tests `test/submit.test.js`, `test/auth.test.js`,
  `test/profile.test.js`, `test/store.cosmos.test.js` (plain-Node, `npm test`
  in `api/`). The `store.cosmos` suite pins the Cosmos document shapes with a
  fake `@azure/cosmos` client (every written item carries an `id`). The
  front end stays fully static — the requested server only exists here, in a
  separate folder, and is not deployed yet.

## The React app (`app/`) — read this too

**This repository contains two independent applications.** Everything above
describes the legacy vanilla-JS app at the repo root, which is what is
committed, CI-covered, deployed to Azure SWA, and wrapped in Tauri. The rules
in "Conventions" (vanilla JS, no bundler) apply **only to that app**.

`app/` is a separate React 19 + TypeScript + Vite + Vitest app with its **own**
model: **10** weighted categories (not 8), a weighted 0–100 score, and four
classification bands. It shares **zero** code with the root app. Its commands
all run from `app/`: `npm run dev`, `npm test`, `npm run typecheck`,
`npm run lint` (oxlint), `npm run build`, `npm run preview`.

- `app/src/types.ts` — `Profile`, `Answers`, `Evaluation`, `QuoteSnapshot`, `View`
- `app/src/lib/questions.ts` — the 10 categories, 40 questions
- `app/src/lib/scoring.ts` — weights, score mapping, `classify()`
- `app/src/lib/recommendations.ts` — strengths, risks, 30/90-day plan
- `app/src/lib/money.ts` — **all** currency handling. `parseMoney`,
  `formatMoney`, `formatMoneyCompact`, `CURRENCY`/`LOCALE` (PHP / en-PH).
  Never hardcode `Intl.NumberFormat` or a currency symbol elsewhere.
- `app/src/lib/catalog.ts` — **the commercial offer.** `Product` and
  `BusinessParameters` (entry gate, tiers, discounts, validity) plus the
  `PRODUCTS` rate card. Content only, no logic. **Prices are placeholders.**
- `app/src/lib/quote.ts` — the quotation engine. `buildQuote()` is pure and
  derives every line from the current answers. `freezeQuote(quote, evaluation)`
  produces a numbered, dated proposal. A quote is never stored as a source of
  truth.
- `app/src/lib/storage.ts` — localStorage persistence. `withDefaults()` carries
  a valid `quoteSnapshot` through and silently drops a malformed one. Use
  `upsertEvaluationMeta()` (not `upsertEvaluation()`) for saves that only attach
  or detach a quote, so `updatedAt` — which quote staleness is measured against —
  does not move.
- `app/src/components/QuoteView.tsx` — live quote and frozen proposal panels
- `app/src/lib/io.ts` — JSON/CSV import-export, plus `quoteToCsv` and
  `quoteSnapshotToJson`
- `app/src/index.css` — all styling, design tokens at the top, `@media print`
  reveals **only** `#report-root`. Any new printable view must wrap itself in
  `<div id="report-root">` or it will print blank. Because that container is
  forced visible, a toolbar placed *inside* it (the quotation's action row is)
  needs its own `@media print { display: none }` rule or it prints as buttons.

Conventions for `app/`: keep pure logic in `app/src/lib/*.ts` (DOM-free, no
mocks) and presentation in `app/src/components/*.tsx`; every new `View` needs a
case in `App.tsx`'s `renderView()` plus a test; accessibility is deliberate
(`aria-live`, `aria-disabled` with a visible reason, `.sr-only`, fieldset/legend)
— match it.

> **The 8-vs-10 category count is NOT a bug — do not "fix" it.**
> `api/src/validate.js` hardcodes `REQUIRED_CATEGORY_COUNT = 8` and pins 8-category
> fixtures in `api/test/submit.test.js`, while `app/` has 10 categories. They are
> not supposed to agree: the API contract belongs to the **legacy root app**
> (8 categories, 0–5 per-question scores, and the `weakness`/`opportunity`/
> `strength`/`unanswered` band vocabulary in `ALLOWED_BANDS`). The React app is a
> separate application, shares no code with the root app, and never calls the
> API. Bumping the constant to 10 would match neither app. The API is also gated
> and not deployed.
>
> If the React app is ever wired to a server, give it a **new contract and
> endpoint** with its own validator and tests. Do not reshape the legacy one.

### The quotation model, in one paragraph

Products are linked to scoring categories. A line is quotable only if the
overall score clears `minOverallToQuote` (the **entry gate**) **and** every
category the product links to clears that product's `minCategory` (the
**product gate**). A locked line is **never hidden** — it is shown with the
exact condition that unlocks it, because a wall reads as a rejection and a goal
reads as work to do. The overall score also selects a discount tier. Freezing is
optional and explicit; it captures the numbers so a price sent to a client
cannot drift, and the UI flags the quote as stale if answers change afterwards.

### The rate card and the delivery timeline

`app/src/lib/catalog.ts` holds the **shipped defaults**; they are not the
source of truth at runtime. `app/src/lib/ratecard.ts` owns the live card:
`loadRateCard()` merges the user's saved overrides onto the shipped catalog by
**product id** and tier id, so a catalog change in a later release adds new
products and new tier fields without discarding edits or misapplying them
(reordering tiers is safe). `saveRateCard()`/`clearRateCard()` round-trip it
through a `StorageProvider`, which is what makes the logic testable. Everything
in `ratecard.ts` is DOM-free and pure; the editor is `RateCardView.tsx`.

Three rules the editor depends on:
- **Validation is pure and separate from the form.** `validateRateCard()` returns
  an error map keyed by `product.<id>.<field>`; the view only decides *when* to
  reveal it. Add a rule there and it is testable without rendering.
- **An empty numeric box is NaN, never 0.** `Number('')` is `0`, which would turn
  a cleared price into a free service. `numberFrom()` in `RateCardView.tsx`
  returns NaN so validation can report the field.
- **Editing the rate card never touches a frozen proposal.** A snapshot holds
  the prices, copy and tier that were issued; `App.tsx` re-renders the quote
  from the live card, but a frozen panel reads only from its snapshot.

The quotation states **two** durations, not one: `sequentialWeeks()` is the plain
sum, and `parallelWeeks()` packs services into `params.parallelism` concurrent
streams using longest-processing-time, returning the busiest stream. That is
deliberately pessimistic — a 12-week engagement cannot be compressed by running
other work beside it, which is exactly what a naive `total / parallelism` gets
wrong. There is a test pinning that case. `parallelism` is an *assumption about
delivery*, shown to the user as such; it never changes a price.

When a tier discount applies, the list price is struck through with a real
`<s>` element and the reduction is named, rather than only being colour-coded.
At 0% there is nothing to strike, so the label stays "Subtotal" — see
`quote-view.test.tsx` for both branches.

## Conventions
- Vanilla JS only (no framework, no bundler). Keep it dependency-free unless
  explicitly asked to add a library — the whole point is zero-install-friction.
  **One documented exception:** the on-device document analyzer vendors the
  `@wllama/wllama` engine under `js/vendor/wllama/` (no build step, no CDN,
  update steps in its `README.txt`). Do not add other runtime dependencies
  without asking.
- Privacy/first principle for the analyzer: uploaded documents are **data, not
  instructions** — never feed them as commands, and treat any "instructions"
  inside a document as prompt-injection to ignore. Documents must never leave
  the device (the model runs in-browser). Suggestions are shown for review and
  are **never** applied automatically.
- Keep `data.js` free of rendering logic; keep `app.js` free of hardcoded
  business content. This separation is intentional so content (categories/
  questions/recommendations) can be edited without touching logic.
- Scoring convention: statements are always phrased so "5 = strongly agree"
  is the *good* outcome. If you add a question, phrase it the same way so
  scoring stays consistent.
- There is no front-end build or bundling step. Front-end tests are plain
  Node (`npm test` → `test/analyzer.test.js`), and the `api/` folder has its
  own plain-Node tests (`npm test` in `api/`); CI runs `node --check` on the
  front-end JS. Keep it dependency-free; when asked to add tests, prefer a
  zero-config, no-install approach like the existing ones.

## How to run
Just open `index.html` in a browser, or serve it locally with the bundled
zero-dependency server:
```
npm run local          # serve.js on http://localhost:4173/ (override with PORT)
npm run mock:auth      # persona SWA/Entra demo at http://127.0.0.1:4174/
npm run auth:github    # REAL GitHub OAuth sign-in demo at http://127.0.0.1:4174/
```
or `npx serve .`, or the VS Code "Live Server" extension. The core app also
works from `file://`, but the optional document analyzer must be served over
HTTP (it loads a `.wasm` module). Run the front-end tests with:
```
npm test               # node test/*.test.js (analyzer, smoke, managed, localauth, serve)
```

### Security expectations
- **Local mode (default):** no accounts, passwords, or roles — a single-user
  offline tool. Anyone who can reach it has full access to local data.
  `serve.js` defaults to 127.0.0.1; do not recommend HOST=0.0.0.0 or
  port-forwarding. localStorage is unencrypted; exported reports are plain
  text. Expect raters to keep customer PII / financials out.
- On-device analyzer never uploads documents — preserve that guarantee.
  Do not add network features without confirming with the user first.
- **Managed mode (Phase 1, opt-in via `MANAGED_ACCESS.enabled`):** the only
  supported identity scheme is SWA/Entra ID. Rules that must hold:
  - The identity key is `principal.userId` (stable IdP id, e.g. Entra object
    id) — **never** fall back to `userDetails` (UPN can change).
  - Never persist identity data or auth tokens in localStorage. The SWA
    `x-ms-client-principal` header is the trust anchor, and SWA strips
    client-supplied copies — the Functions handlers must keep enforcing
    auth/roles/CSRF/rate limits server-side regardless.
  - Roles are exactly `Evaluator` / `Reviewer` / `Administrator`, assigned by
    administrators in Entra — there is **no** first-visitor admin bootstrap.
  - Profile (onboarding) endpoints: authenticated only, no role gate; import
    is off unless `ALLOW_IMPORTS=true`. Submit is role-gated server-side.
  - Keep out-of-process/durable rate limiting as the documented requirement
    before scaling the API horizontally.

## Common tasks (you / opencode may be asked to do here)

### In the React app (`app/`)
- Change a product, price, or quote threshold → `app/src/lib/catalog.ts` only.
  `Product` fields drive the line item; `BUSINESS_PARAMETERS` drives the entry
  gate, tiers, discounts, parallelism, and validity window. No component or
  engine change should be needed. These are **defaults**: edit them to change
  what a fresh browser sees, and add a test to `sample.test.ts` if the change
  would move the sample's score, tier, or lock count.
- Add a new quotable service → add it to `PRODUCTS` in `catalog.ts`. Do **not**
  touch the merge logic: `mergeRateCard()` picks it up automatically, and a
  saved card that predates it will still resolve. Deleting or renaming an
  `id` is a breaking change, because `mergeRateCard()` keys on it.
- Add a validation rule to the rate card → `validateRateCard()` in
  `app/src/lib/ratecard.ts`, returning a `RateCardErrorKey`; surface it in
  `RateCardView.tsx` and pin it in `ratecard.test.ts`.
- Change the quotation's eligibility logic → `app/src/lib/quote.ts`
  (`buildLine`, `tierFor`). Keep it pure and DOM-free; add cases to
  `app/src/__tests__/quote.test.ts`.
- Change the currency or peso display → `app/src/lib/money.ts`
  (`CURRENCY`/`LOCALE`). Do not re-introduce a local `formatCost`.
- Add a quotation export format → extend `quoteToCsv` / `quoteSnapshotToJson`
  in `app/src/lib/io.ts`, reusing `csvRowsToText()` and `downloadTextFile()`.
- Change the score bands or classification → `app/src/lib/scoring.ts`
  (`classify()`). `io.ts` and the UI read the thresholds from there, so there
  is only one copy.

### In the legacy root app
- Add a new assessment category or question → edit `js/data.js` only.
  Note: the `api/` validation contract expects exactly **8** categories —
  changing the category count means updating `REQUIRED_CATEGORY_COUNT` in
  `api/src/validate.js` and the fixtures in `api/test/submit.test.js` too.
- Change scoring thresholds (what counts as weak/ok/strong) → `SCORE_BANDS`
  in `js/data.js`.
- Change the plain-language overlay (the ⓘ buttons) → its text comes from the
  `simple` fields in `js/data.js`; the behavior lives in `createInfoButton()`
  and `toggleInfoOverlay()` in `js/app.js` (single `#info-overlay` element,
  positioned near the clicked button and dismissed on outside-click/Esc).
  Questions always display `text` (business); there is no global wording toggle.
- Add a results export format (PDF, CSV, email) → extend `exportResults()`
  in `js/app.js`; keep the existing .txt export working unless told to
  replace it. (A zero-dependency "Print / Save as PDF" button already exists
  via `printResults()` + the print stylesheet.)
- Change the snapshot/history behaviour (auto-save, compare, export/import)
  → edit the history block in `js/app.js` (`HISTORY_KEY`, `createSnapshot()`,
  `renderHistory()`, `showCompare()`, `exportHistoryJson()`, `importHistoryJson()`);
  the UI lives in the `#history` section of `index.html`.
- Change the document analyzer (on-device score assist) → config in `ANALYZE`
  (`js/data.js`: provider/model/limits), logic in `js/analyzer.js`
  (providers) + `js/analyzer-parse.js` (pure doc→text + prompt/parse), UI in
  the `#analyze` section of `index.html` with `runAnalyze()`,
  `renderAnalyzeResults()`, `applyAnalyzeSuggestions()` in `js/app.js`. Keep
  the pure parts in `analyzer-parse.js` so `npm test` covers them. To change
  the model, point `ANALYZE.modelRepo`/`modelFile` at another GGUF (do not
  vendor weights). To ship it, the app must be served over HTTP.
- Change the submission target → edit `SUBMIT_FORM` in `js/data.js`:
  `apiUrl` (Phase 1 API), `formUrl` + optional `prefillTemplate` (Microsoft
  Form fallback). The submit flow lives in `submitResults()` in `js/app.js`
  (`buildSubmissionPayload()` builds the API body). Order of attempts: API
  first (on success/failure), then prefill, then clipboard + form. The front
  end stays static — no server added there.
- Modify the submit API → edit `api/src/` (or add tests in `api/test/`), run
  `npm test` in `api/` (runs submit + auth + profile suites). Note
  `handler.js` and `profile-handler.js` are framework-agnostic and injected
  with a store, so tests need no Azure packages. Add a new endpoint → create
  a handler + a thin `app.http(...)` adapter in `api/src/functions/`, mirror
  the `requireAuthenticated`/`requireRole`/`checkRequestEnvelope`/limiter/
  `createAuditor` pattern from `submit.js`/`profile.js`, and extend the tests.
- Change the managed sign-in flow (gate states, onboarding form, language of
  banners) → `js/managed.js` (state machine + `ManagedAccess.init` with
  injectable config/fetch/navigate), styles in `css/style.css`, config in
  `MANAGED_ACCESS` (`js/data.js`). Never weaken the no-localStorage-identity
  rule, and keep a class under `test/managed.test.js` covering the changed
  state. The API side (profile/onboarding contract) lives in
  `api/src/profile-handler.js`.
- Change the no-Azure demo servers (`npm run mock:auth` / `npm run auth:github`)
  → shared plumbing in `scripts/localauth-lib.js` (static delegation, data.js
  rewrite, cookie/json/body helpers — keep both servers on it). The GitHub
  server's `/api/*` must keep delegating to the REAL `api/src` handlers with a
  memory store; the persona mock may fake profile endpoints. Keep the
  identity key as the stable IdP id (`userId`, never `userDetails`), no OAuth
  token stored in the session cookie or on disk (exchanged once, used in
  memory, dropped), `scripts/.github-oauth.json` + `scripts/github-roles.local.json`
  in `.gitignore` (never commit a client secret or a real username map), and
  the exported `createGithubServer`/`buildPrincipal` contracts pinned by
  `test/localauth.test.js` (add cases when you change the OAuth/principal
  path).
- Add persistence beyond what exists (multi-snapshot localStorage history
  with compare/export is already in; anything more, e.g., a synced backend)
  → propose a plan before adding a backend, since this is currently a fully
  static/offline app by design.
- Deploy to GitHub Pages → no build step needed; the repo root can be
  published directly.

## Do NOT
- Do not introduce a backend/server or database without explicitly
  confirming with the user first — this app is intentionally static (the
  gated `api/` folder is the one sanctioned exception, still not deployed).
- Do not remove the localStorage persistence without replacing it with
  something at least as good (users expect answers to survive a refresh).
- Do not auto-apply analyzer suggestions, and do not send uploaded documents
  to any server/CDN — inference stays on-device. Only the model weights are
  fetched (from Hugging Face) and the browser caches them.
- Do not ship managed-mode changes that store identity/tokens in localStorage,
  weaken server-side auth/role/CSRF checks, or remove the no-first-visitor-
  admin-bootstrap guarantee.
- Do not enable `MANAGED_ACCESS` in the shipped default `js/data.js` — it
  must remain `enabled: false` (local/offline is the product's default).
- Do not commit the gitignored local auth secrets/roles
  (`scripts/.github-oauth.json`, `scripts/github-roles.local.json`), and keep
  the `auth:github` server free of stored OAuth tokens.
- Do not send quotations anywhere. The quotation is a local estimate; exporting
  to CSV/JSON/PDF is a manual, user-initiated download. Adding an "email this
  quote" or "request a booking" button would need a backend — confirm first.
- Do not present a quotation as binding. Keep the "estimate, not a binding
  offer" disclaimer and the validity date on every client-facing surface.
- Do not hide a locked quotation line. Always show the unlock condition.
- Do not present the parallel timeline as a promise. It is an estimate derived
  from `parallelism`, which the user sets; state the assumption next to the
  number and keep the sequential total visible as the honest baseline.
- Do not let a rate-card edit rewrite a frozen proposal. Snapshots are the
  client's record of what was issued — `app.test.tsx` pins this.
- Do not add tax or statutory-contribution calculations to the quote; the
  current terms explicitly exclude them. Adding tax handling is a scope and
  compliance decision, not a formatting change.
