# Phase 1 Plan — Corporate Rollout of the Business Self-Evaluation Tool

**Status:** Steps 1-2 complete. Repo on GitHub (`marequiron/business-evaluator`). **Hosting pivoted from Azure to Cloudflare Pages + Functions + KV.** Code is ready; requires dashboard setup (see `CLOUDFLARE-SETUP.md`).
**Owner:** marequiron
**Target date:** [to fill]

This document is the step-by-step plan to take the app from the Phase 0
(today: static app + Microsoft Form collection) to a managed corporate
rollout. It splits into two parts:

1. **Implementation steps** — hosting, identity, backend, wiring, ops.
2. **Data-privacy note** — the write-up to present at the approval gate.

---

## 0. Where we are (Phase 0 baseline)

- Static web app in `business-evaluator/` (HTML/CSS/JS, no build step).
- Runs client-side; answers live in each user's browser `localStorage`.
- Two wording modes: **simple** (default) and **standard**.
- Results export as `.txt`, or submit to a Microsoft Form
  (`SUBMIT_FORM` in `js/data.js`).
- No server, no database, no accounts.

**What this phase adds:** a supported backend + identity so the org can
collect results reliably, attribute them (optional), and later benchmark.

---

## 1. Target architecture (Phase 1)

```
  User browser (index.html, unchanged UI)
        │  answers → localStorage + scoring (client-side, as today)
        ▼
  Submit results
        ├─ (fallback, kept) Microsoft Form       …for small/unattended use
        └─ (primary, new)   HTTPS POST ──► Cloudflare Pages
                                              │  functions/api/submit.js
                                              ▼
                                   Cloudflare KV (SUBMISSIONS_KV namespace)
                                              │
                                              ▼
                                   Aggregation views → later (Phase 2)
```

Decisions to confirm before building (they affect consent wording and layout):

| Decision | Option A (recommended start) | Option B | **CHOSEN** |
|---|---|---|---|
| **Attribution** | Anonymous scores; optional non-PII label (e.g., "Business A") | Named identity per user | **Option A — Anonymous** |
| **Storage** | Cloudflare KV (JSON) | Durable Objects / external DB (Postgres) | **Option A — KV** |
| **Deployment** | GitHub repo → Cloudflare Pages (Git integration) | Manual upload | **Option A — GitHub/Git** |
| **Hosting region (Cloudflare)** | Anycast edge (global) | — | **Cloudflare global edge** |

---

## 2. Implementation steps

### Step 1 — Freeze the Phase 0 baseline ✅
- Tag the current folder state (git commit + tag `v1.0-phase0`).
- Lock `SUBMIT_FORM` config as the fallback path.
- Agree scope for this phase (no question-content changes; those stay in
  `js/data.js` and are decoupled from rollout).

### Step 2 — Decide the data model & privacy defaults ✅
- Fill in the **Decision table** above.
- Draft the consent line users see at the Submit step (see privacy note,
  §6).
- Choose data residency region for the Azure resources (align with org
  policy) — affects consent text and the approval gate. **Region: East US.**

### Step 3 — Provision Cloudflare resources (dashboard)
> **Status: code ready, dashboard pending** — see `CLOUDFLARE-SETUP.md` for click-by-click steps.
- **Cloudflare account** (free tier is sufficient): connect the GitHub repo at
  https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → Connect to Git.
- **Pages project** — publish repo root as-is (no build step, output dir `/`).
- **KV namespace** `SUBMISSIONS` → bind to the Pages project as `SUBMISSIONS_KV`
  (under **Pages → Settings → Functions → KV namespace bindings**).

### Step 4 — Access control (optional)
- For an internal tool, gate who can reach the app with **Cloudflare Access**
  (page-level allow/deny, no code change needed).
- The submit function supports a `REQUIRE_AUTH` env var (returns 403 when set to
  `true`) as a coarse kill-switch. Real identity/per-user gating is done at the
  Cloudflare Access layer instead of in code.

### Step 5 — Build the submit API
> **Status: done — ported to Cloudflare Pages Function.** `functions/api/submit.js`
> is a self-contained ES module (no npm install needed). 11 unit tests pass
> (`npm test`). The original Azure `api/` code is kept intact as reference and
> fallback but is NOT deployed.

Implementation:
- `functions/api/submit.js` — Cloudflare Pages Function for `POST /api/submit`:
  1. Rejects: empty body (400), invalid JSON (400), oversized >10 KB (413),
     wrong shape per `validateSubmit` (400), `REQUIRE_AUTH=true` (403),
     non-POST (405).
  2. Accepts (202): stamps `submissionId`, `submittedAt`, `schemaVersion: 1`.
  3. Storage: writes the submission JSON to the `SUBMISSIONS_KV` binding under
     key `submissionId`. Without a KV binding: dev env logs-and-acks
     (`stored:false`); otherwise returns 500 so nothing is silently dropped.
- `wrangler.toml` — documents the `SUBMISSIONS_KV` binding (replace the
  namespace id) and Pages output dir for local dev (`npx wrangler pages dev .`).
- Tests: `test/submit-cf.test.mjs` — 11 checks in plain Node (built-ins only).
- `CLOUDFLARE-SETUP.md` — step-by-step dashboard guide + verification steps.

### Step 6 — Wire the app's Submit button
> **Status: done.** `SUBMIT_FORM.apiUrl` is set to a **relative** endpoint so it
> works in every Pages deployment (prod + preview).

- In `js/data.js`:
  ```js
  apiUrl: "/api/submit"   // Cloudflare Pages Function on the same domain
  ```
- In `js/app.js`, `submitResults()` order of attempts:
  1. If `apiUrl` set → `fetch(apiUrl, {method:"POST", body})`; on success show
     "Your results were submitted". A failed request (non-2xx or network error)
     falls through to the form paths below, so collection is never blocked.
  2. Else if `prefillTemplate` set → pre-filled form (Phase 0 behavior).
  3. Else → clipboard + open `formUrl` (Phase 0 fallback).
- Payload shape (`buildSubmissionPayload()` in `js/app.js`):
  `{ language, categories: [{ id, label, score, band }] }` — matches the
  Cloudflare function's `validateSubmit`.
- Keep the Microsoft Form path intact as the offline/unattended fallback
  (per the project's "do not remove existing capability" rule).

### Step 7 — Security & compliance controls
- HTTPS everywhere (Cloudflare default). Site-level gate via Cloudflare Access
  for internal-only reach.
- No secrets in front-end code; the function runs server-side on Cloudflare.
- CORS is not an issue with a same-origin relative `/api/submit`; if the site
  is ever moved off-domain, lock CORS to that domain.
- Rate limiting at the API (e.g., 20 submits/hr per identity or IP) —
  Cloudflare WAF/rate-limiting rule or function-level check.
- Data at rest: Cloudflare KV is encrypted at rest; no customer PII expected
  in Option A.
- Align with org scanners; keep secrets out of the repo.

### Step 8 — Staging + CI/CD
- Repo: `business-evaluator` on GitHub; Cloudflare Pages **Git integration**
  auto-builds on every push to `main` (green = PR preview, blue = production).
- Pipeline: push `main` → Cloudflare runs tests? — currently Cloudflare builds
  and deploys without running our test suite. **Recommended:** the local
  workflow (`npm test` at root for the Cloudflare function) is run by the
  existing GitHub Actions workflow `deploy-azure-static-web-apps.yml`; see note on
  keeping tests wired in CI.
- Environments: Cloudflare gives each PR a **preview URL** automatically;
  `main` is **production**. No separate staging infra needed.
- Tagged releases only reach prod if you gate the Pages project's production
  branch (Settings → Builds & deployments → Production branch = `main`).

### Step 9 — Monitoring & operations
- Cloudflare Pages/Workers analytics: watch failed submits; alert on >5 in
  10 min (Workers logs + email/Webhook).
- Backups: KV is highly available with Cloudflare's edge storage; export
  snapshots periodically if long-term retention is needed.
- Retention policy: submissions kept 24 months, then purged (align with the
  consent text in §6) — implement a scheduled purge Worker (Cron Trigger)
  if you want it automatic.
- Runbook: on-call contact, incident/recovery steps, data deletion
  procedure (subject to user/org requests).

### Step 10 — Pilot & rollout
- Pilot: 5–10 users; collect 2 weeks of submissions; validate API reliability
  and review the aggregated numbers with the data owner.
- Training one-pager (where to go, what happens to results, how to
  resubmit).
- Full rollout to the target group(s); gate access with Cloudflare Access so
  uninvited users can't reach (or read) collected data.
- Retire the Microsoft Form path only after the API path is stable for 1+.

### Step 11 — Straight-line to Phase 2 (later)
- Once submissions accumulate: export KV → Power BI / BI tool for
  benchmark/industry comparisons and over-time trends (the README roadmap
  items). Needs the data model agreed in Step 2; no re-architecture.

---

## 3. What does NOT change

- Question content, scoring bands, both language wordings.
- The `.txt` export and local persistence.
- The static, dependency-free rule for the *front end* (no framework added).

---

# Part 2 — Data-privacy note (for the approval gate)

> Fill the bracketed `[ ]` fields; remove the note's instructions once done.
> Target audience: IT security / privacy / procurement reviewers.

### 1. Purpose
- The tool runs a business self-evaluation: users answer 7 categories of
  1–5 rating questions, get per-category strengths/weaknesses/opportunities,
  and receive tailored recommendations.
- Users may voluntarily submit their anonymized results so [ORG] can
  understand capability gaps and target support/benchmarking. Submission is
  **optional**; using the evaluation itself never requires it.

### 2. What is collected
- Per-category numeric scores (7 values), computed score band, which language
  wording was used, timestamp of submission.
- Optional non-PII label if approved (e.g., "Business A") — **no name /
  email / contact details** unless Option B (named attribution) is approved,
  in which case the sign-in identifier (Entra ID UPN) is stored.
- No payment, location, biometric, or health data.
- Client-side answers (`localStorage`) are the user's own data and never
  transmitted unless they press “Submit results”.

### 3. Who has access
- [ORG] program owner(s)/[DATA OWNER role], and the Cloudflare account
  admins under least-privilege; aggregated dashboards to [LEADERSHIP BODY]
  only if approved for Phase 2.
- Processed by Cloudflare services (global edge network), list:
  - Phase 0: Microsoft Forms / SharePoint/Excel (fallback only).
  - Phase 1: Cloudflare Pages, Cloudflare Functions, Cloudflare KV.

### 4. Where data lives & retention
- Stored in Cloudflare KV (data replicated across Cloudflare's global edge;
  [ORG to confirm acceptable residency / any region pinning needed]).
- Retention: **24 months**, then deleted or fully anonymized.
- Deletion process: scheduled purge + documented manual deletion path on
  request ([CONTACT]).

### 5. Lawful basis & transparency
- Basis: legitimate interest / [ORG policy reference]; submission is
  voluntary and the Submit screen will show the one-line consent notice
  (“By submitting, you agree that [ORG] stores these anonymous results for
  24 months to improve support and benchmarking”).
- Users can withdraw: deletion request via [CONTACT] processed within
  [30] days.

### 6. Security controls
- Transport: HTTPS only (Cloudflare default, automatic).
- Authentication: optional — gate the app with Cloudflare Access (page-level
  allow list) for an internal tool; role-gated submission handled there.
- API: server-side validation, size caps, rate limiting, CORS locked if needed.
- No secrets in front-end code; the function validates payload before storing.
- Encryption at rest (Cloudflare KV default encryption); logs exclude PII.
- Monitoring: alerts on abnormal submit failures/volumes.

### 7. Third-party/processor & DPIA
- Cloudflare, Inc. is the processor — [ORG] remains controller.
- A DPIA is recommended if Option B (named attribution) is chosen, since it
  introduces identifiable data.

### 8. Data minimization & user expectations
- Only fields required for scoring/benchmarking are collected; nothing extra.
- Individuals keep their own results privately (localStorage); the org sees
  only what users choose to submit.

### 9. Roles & sign-off
- Data owner/controller: [NAME/ROLE]
- Technical lead: [NAME/ROLE]
- Security review: [NAME/ROLE]
- Privacy review: [NAME/ROLE]
- Approval date/sign-off: [   ]

---

## Next actions
1. Fill the `[ ]` placeholders (owner, retention, contacts, reviewer roles).
2. **Do the Cloudflare dashboard setup in `CLOUDFLARE-SETUP.md`** — connect
   the GitHub repo as a Pages project, create the `SUBMISSIONS` KV namespace,
   and bind it as `SUBMISSIONS_KV`. Then verify `/api/submit` returns 202.
3. Decide organisation data-residency stance on Cloudflare's global edge (for
   §4 of Part 2) — affects the approval gate.
4. Submit §Part-2 note with the Phase 1 steps for the approval gate.