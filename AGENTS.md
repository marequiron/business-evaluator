# Business Self-Evaluation Tool — Project Instructions for opencode

## What this project is
A single-page web app that lets a business owner answer Likert-scale (1-5)
questions across 8 categories, then automatically classifies each category as
a **Strength**, **Weakness**, or **Opportunity** and shows a tailored
recommendation for it. No backend, no build step, no database — pure static
HTML/CSS/JS so it's easy to run, deploy (e.g., GitHub Pages), and extend.

## Project structure
- `index.html` — page shell, loads `js/data.js` then `js/app.js`.
- `css/style.css` — all styling. Uses CSS custom properties at the top
  (`--strength`, `--opportunity`, `--weakness`, `--accent`) for the color
  scheme — change these instead of hunting for hex codes elsewhere.
- `js/data.js` — **the content model**. Contains `CATEGORIES` (array of
  category objects: id, label, icon, questions[], recommendations{weakness,
  opportunity, strength}), `SCORE_BANDS` (thresholds that decide which band
  a category's average score falls into), and `SUBMIT_FORM` (Microsoft Form
  link/prefill for the "Submit results" button). Add/edit categories and
  questions here. Also holds `ANALYZE` (on-device analyzer config: provider,
  model repo/file, context size, max input length) — content/config only, no
  rendering logic — so no other file needs to change for content edits.
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
- `test/analyzer.test.js` — plain-Node unit tests (analyzer helpers +
  providers), run with `npm test` from the repo root.
- `serve.js` — zero-dependency local static server (`npm run local`, default
  port 4173). Serves `.wasm` with the right MIME type; needed by the analyzer.
- `api/` — Phase 1 submission service (Azure Functions → Cosmos DB), behind
  an approval gate (see `PHASE-1-PLAN.md`). `src/validate.js` (pure payload
  checks), `src/handler.js` (framework-agnostic request logic), `src/store.js`
  (Cosmos persistence), `src/functions/submit.js` (Azure HTTP adapter),
  `test/submit.test.js` (plain-Node unit tests, `npm test` in `api/`). The
  front end stays fully static — the requested server only exists here, in a
  separate folder, and is not deployed yet.

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
```
or `npx serve .`, or the VS Code "Live Server" extension. The core app also
works from `file://`, but the optional document analyzer must be served over
HTTP (it loads a `.wasm` module). Run the front-end tests with:
```
npm test               # node test/analyzer.test.js
```

## Common tasks you (opencode) may be asked to do here
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
  `npm test` in `api/`. Note `handler.js` is framework-agnostic and injected
  with a store, so tests need no Azure packages.
- Add persistence beyond what exists (multi-snapshot localStorage history
  with compare/export is already in; anything more, e.g., a synced backend)
  → propose a plan before adding a backend, since this is currently a fully
  static/offline app by design.
- Deploy to GitHub Pages → no build step needed; the repo root can be
  published directly.

## Do NOT
- Do not introduce a backend/server or database without explicitly
  confirming with the user first — this app is intentionally static.
- Do not remove the localStorage persistence without replacing it with
  something at least as good (users expect answers to survive a refresh).
- Do not auto-apply analyzer suggestions, and do not send uploaded documents
  to any server/CDN — inference stays on-device. Only the model weights are
  fetched (from Hugging Face) and the browser caches them.
