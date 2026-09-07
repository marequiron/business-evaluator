# Business Self-Evaluation Tool — Project Instructions for opencode

## What this project is
A single-page web app that lets a business owner answer Likert-scale (1-5)
questions across 7 categories, then automatically classifies each category as
a **Strength**, **Weakness**, or **Opportunity** and shows a tailored
recommendation for it. The core app is pure static HTML/CSS/JS. Phase 1 adds
an optional submission API (Cloudflare) — see `PHASE-1-PLAN.md`.

## Project structure
- `public/` — the static site (this is what Cloudflare uploads as assets):
  - `public/index.html` — page shell, loads `js/data.js` then `js/app.js`.
  - `public/css/style.css` — all styling. Uses CSS custom properties at the
    top (`--strength`, `--opportunity`, `--weakness`, `--accent`) for the
    color scheme — change these instead of hunting for hex codes elsewhere.
  - `public/js/data.js` — **the content model**. Contains `CATEGORIES`,
    `SCORE_BANDS`, and `SUBMIT_FORM` (apiUrl + Microsoft Form links/prefill
    for the "Submit results" button). Add/edit categories and questions here
    — no other file needs to change for content edits.
  - `public/js/app.js` — rendering + logic. Builds the form from `CATEGORIES`,
    stores answers in `localStorage` (key: `business-evaluator-answers-v1`),
    computes per-category averages, renders the bar chart + result cards, and
    handles the wording toggle, "Export Results", "Submit results", "Reset".
- `functions/api/submit.js` — the deployed submission API (Cloudflare
  Function, group-internal approval-pending). Validates and stores submitted
  evaluations in Cloudflare KV.
- `dist/worker/index.js` — the compiled Worker bundle that Cloudflare runs.
  Generated from `functions/` via `npm run build:worker`; **the committed
  bundle must be kept in sync** — CI enforces `git diff --exit-code`.
- `wrangler.jsonc` — Cloudflare Workers static-assets config (assets from
  `public/`, main = `dist/worker/index.js`). No KV binding id committed.
- `api/` — legacy Azure reference implementation (Azure Functions → Cosmos
  DB), kept as design reference but NOT deployed. Tests still pass.

## Conventions
- Vanilla JS only (no framework, no bundler). Keep it dependency-free unless
  explicitly asked to add a library — the whole point is zero-install-friction.
- Keep `data.js` free of rendering logic; keep `app.js` free of hardcoded
  business content. This separation is intentional so content (categories/
  questions/recommendations) can be edited without touching logic.
- Scoring convention: statements are always phrased so "5 = strongly agree"
  is the *good* outcome. If you add a question, phrase it the same way so
  scoring stays consistent.
- Tooling: Node-based `npm test` (function unit tests + compiled-bundle smoke
  tests) and `npm run build:worker` (wrangler). Run `npm test` after any
  `functions/` change and rebuild the bundle.

## How to run
Open `public/index.html` directly in a browser (the app runs offline), or serve it:
```
npm start          # npx serve public
```
or use the VS Code "Live Server" extension pointed at `public/`.

## Common tasks you (opencode) may be asked to do here
- Add a new assessment category or question → edit `public/js/data.js` only.
- Change scoring thresholds (what counts as weak/ok/strong) → `SCORE_BANDS`
  in `public/js/data.js`.
- Add a results export format (PDF, CSV, email) → extend `exportResults()`
  in `public/js/app.js`; keep the existing .txt export working unless told to
  replace it.
- Change the submission target → edit `SUBMIT_FORM` in `public/js/data.js`:
  `apiUrl` (Cloudflare API), `formUrl` + optional `prefillTemplate` (Microsoft
  Form fallback). The submit flow lives in `submitResults()` in
  `public/js/app.js` (`buildSubmissionPayload()` builds the API body). Order
  of attempts: API first (on success/failure), then prefill, then clipboard +
  form. The front end stays static — no server added there.
- Modify the submit API → edit `functions/api/submit.js`, then run
  `npm test` and `npm run build:worker`, and commit the regenerated
  `dist/worker/index.js` too (CI checks it stays in sync).
- Add persistence beyond localStorage (e.g., save multiple assessments,
  compare over time) → propose a plan before adding a backend, since this
  is currently a fully static/offline app by design.
- Deploy to Cloudflare → push to `main`; Cloudflare auto-deploys via
  `wrangler.jsonc` (`npx wrangler deploy`). See `CLOUDFLARE-SETUP.md` for the
  dashboard-only parts (KV binding, vars).

## Do NOT
- Do not change the app's static, dependency-free front end — the backend that
  exists lives only in `functions/` / `dist/` (Cloudflare) and must not pull a
  framework or server into `public/`.
- Do not remove the localStorage persistence without replacing it with
  something at least as good (users expect answers to survive a refresh).
