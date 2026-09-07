# Phase 1 Plan — Corporate Rollout of the Business Self-Evaluation Tool

**Status:** Steps 1-2 complete. Repo on GitHub (`marequiron/business-evaluator`). CI/CD workflow in place. Step 3 partially done — Azure resources not yet created.
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
        └─ (primary, new)   HTTPS POST ──► Azure Static Web Apps
                                              │  auth callback (Entra ID)
                                              ▼
                                   Azure Functions API  (validate + store)
                                              ▼
                                   Azure Cosmos DB / SQL  (or Table Storage)
                                              │
                                              ▼
                                   Aggregation views → later Power BI (Phase 2)
```

Decisions to confirm before building (they affect consent wording and layout):

| Decision | Option A (recommended start) | Option B | **CHOSEN** |
|---|---|---|---|
| **Attribution** | Anonymous scores; optional non-PII label (e.g., "Business A") | Full Entra ID identity per user | **Option A — Anonymous** |
| **Storage** | Azure Cosmos DB (JSON) | Azure SQL / Table Storage (if that's your org standard) | **Option A — Cosmos DB** |
| **Deployment** | GitHub repo → Actions → Azure Static Web Apps | Azure DevOps pipeline | **Option A — GitHub** |
| **Region** | [TBD — align with org policy] | | **East US** |

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

### Step 3 — Provision Azure resources
Resource group: `rg-business-evaluator` (region: **East US**)
- **Azure Static Web Apps** (Standard SKU for managed auth + custom domain)
  - Publish root of `business-evaluator/` (no build step needed).
- **Azure Functions** (same SWA plan; separate `api/` endpoint or in-plan)
  - Endpoint: `POST /api/submit`
- **Data store:** Azure Cosmos DB (serverless), container `submissions`
  (or SQL/Table if chosen).
- **Application Insights** (telemetry; no PII in logs).

### Step 4 — Enable Entra ID (Microsoft Entra) authentication (SWA managed)
- Register the SWA app; enable **"Managed identities for authenticated
  users"** (AKA authenticate by access tokens / invoke functions).
- Define one app role **"Business-Evaluator Submitters"**; assign to the
  target user group rather than individuals where possible.
- If Option A (anonymous) chosen: make sign-in *optional but encouraged* —
  gating access to corporate members while keeping scores unnamed.

### Step 5 — Build the submit API
> **Status: scaffolded.** Working, tested code exists under `api/` — deploy and
> run `npm install` + `npm test` there. Remaining: standing up the real Azure
> resources and wiring the env vars.

New files only; no change to existing rendering/scoring logic.
- `api/` (Azure Functions, Node v4 `@azure/functions`, trigger `POST /api/submit`):
  1. `api/src/validate.js` — payload shape (exactly 7 categories, scores 0–5,
     bands `weakness|opportunity|strength|unanswered`, language
     `simple|standard`), plus size cap (10 KB) and field checks. Pure and
     dependency-free.
  2. `api/src/handler.js` — framework-agnostic request handling: 400 empty/
     invalid-JSON/bad-shape, 413 oversized, 403 when `REQUIRE_AUTH=true` and
     the caller lacks `SUBMITTER_ROLE`, 202 for good submissions. Stamps
     `submissionId`, `submittedAt`, `schemaVersion: 1`.
  3. `api/src/store.js` — Cosmos DB persistence (`@azure/cosmos`); honors
     `COSMOS_CONNECTION_STRING` or `COSMOS_ENDPOINT`+`COSMOS_KEY`,
     `COSMOS_DATABASE` (default `business-evaluator`), `COSMOS_CONTAINER`
     (default `submissions`). `DEV_NO_STORE=true` (or Functions dev env) logs
     and returns without storing; otherwise storage failure raises and the
     handler returns 500 so nothing is silently dropped.
  4. `api/src/functions/submit.js` — thin `app.http('submit', ...)` adapter:
     decodes the SWA `x-ms-client-principal` header into the handler's
     `principal`. Function `authLevel` is `anonymous` — access control lives
     in the SWA layer + the handler's role gate.
- Env vars reference (also in `api/local.settings.json.example`):
  `COSMOS_CONNECTION_STRING` | `COSMOS_ENDPOINT`+`COSMOS_KEY`,
  `COSMOS_DATABASE`, `COSMOS_CONTAINER`, `REQUIRE_AUTH`, `SUBMITTER_ROLE`,
  `DEV_NO_STORE`.
- Tests: `api/test/submit.test.js` runs in plain Node (`npm test` in `api/`,
  no install needed) — 17 checks covering validation, auth, store failure,
  and Cosmos-config states.
- Function auth (deployed): require the SWA-issued access token (managed
  identity); do **not** accept anonymous function-level calls except during a
  reviewed pilot window.

### Step 6 — Wire the app's Submit button
> **Status: done** (front-end fully wired and smoke-tested). Only the real
> `apiUrl` value and any auth header option remain.

- In `js/data.js` add to `SUBMIT_FORM`:
  ```js
  apiUrl: ""   // e.g. "https://<swa>.azurestaticapps.net/api/submit"
  ```
- In `js/app.js`, `submitResults()` order of attempts:
  1. If `apiUrl` set → `fetch(apiUrl, {method:"POST", body})`, send the auth
     token if the user signed in; on success show "Your results were
     submitted". A failed request (non-2xx or network error) falls through to
     the form paths below, so collection is never blocked.
  2. Else if `prefillTemplate` set → pre-filled form (Phase 0 behavior).
  3. Else → clipboard + open `formUrl` (Phase 0 fallback).
- Payload shape (`buildSubmissionPayload()` in `js/app.js`):
  `{ language, categories: [{ id, label, score, band }] }` — matches
  `api/src/validate.js`.
- Keep the Microsoft Form path intact as the offline/unattended fallback
  (per the project's "do not remove existing capability" rule).

### Step 7 — Security & compliance controls
- HTTPS everywhere (SWA default). HSTS header on.
- No secrets in front-end code: the API call is unauthenticated-by-token UI
  → Functions validates identity server-side.
- CORS locked to your SWA domain.
- Rate limiting at the API (e.g., 20 submits/hr per identity or IP).
- Data at rest: Cosmos default encryption; no customer PII expected in
  Option A.
- Align with org scanners (Defender for Cloud, secret scanning in repo).

### Step 8 — Staging + CI/CD
- Repo: `business-evaluator` with GitHub Actions (or Azure DevOps).
- Pipeline: push `main` → run `node --check` on JS + `api` → publish SWA →
  smoke test the deployed URL with a headless check (reuse the existing
  throwaway jsdom harness as a real `test/*.test.js` if approved nice-to-have).
- Environments: `dev` (free/SWA staging) → `prod`.
- Tagged releases only reach prod.

### Step 9 — Monitoring & operations
- Application Insights alert: >5 failed submits in 10 min.
- Backups: Cosmos continuous backup (Point-in-Time, default 30 days).
- Retention policy: submissions kept 24 months, then purged
  (align with the consent text in §6) — implement a scheduled purge
  Function if you want it automatic.
- Runbook: on-call contact, incident/recovery steps, data deletion
  procedure (subject to user/org requests).

### Step 10 — Pilot & rollout
- Pilot: 5–10 users; collect 2 weeks of submissions; validate API reliability
  and review the aggregated numbers with the data owner.
- Training one-pager (where to go, what happens to results, how to
  resubmit).
- Full rollout to the target group(s); assign **Submitters** role via a
  security group so uninvited users can't see the collected data.
- Retire the Microsoft Form path only after the API path is stable for 1+.

### Step 11 — Straight-line to Phase 2 (later)
- Once submissions accumulate: Power BI dataset over the Cosmos container →
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
- [ORG] program owner(s)/[DATA OWNER role], and Azure platform admins under
  least-privilege; aggregated dashboards to [LEADERSHIP BODY] only if
  approved for Phase 2.
- Processed by Microsoft Cloud services: **East US** region, list:
  - Phase 0: Microsoft Forms / SharePoint/Excel (fallback only).
  - Phase 1: Azure Static Web Apps, Azure Functions, Cosmos DB,
    Application Insights.

### 4. Where data lives & retention
- Stored in **East US** Azure regions only (no cross-border transfer beyond it).
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
- Transport: HTTPS/HSTS only.
- Authentication: optional Entra ID sign-in; role-gated Submitters access.
- API: server-side validation, size caps, rate limiting, CORS locked.
- No secrets in front-end code; Functions validate identity before storing.
- Encryption at rest (Cosmos default); Application Insights logs exclude PII.
- Monitoring: alerts on abnormal submit failures/volumes.

### 7. Third-party/processor & DPIA
- Microsoft (Azure/M365) is the processor — [ORG] remains controller.
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
1. Fill the `[ ]` placeholders (owner, region, retention, contacts).
2. Decide the attribution & storage options in §2 — they gate Step 2 and the
   consent wording in §5.
3. Submit §Part-2 note with the Phase 1 steps for the approval gate.