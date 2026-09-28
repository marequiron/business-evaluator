# Phase 1 Plan — Corporate Rollout of the Business Self-Evaluation Tool

**Status:** In progress — Steps 1-2 complete, Step 3 pending Azure resources.
Managed authentication + onboarding (Step 4) and the hardened submit/profile
API (Step 5) are **implemented and unit-tested**; remaining work is
provisioning real Azure resources and wiring env vars.
**Deploy guide:** follow [`PHASE-1-DEPLOY-RUNBOOK.md`](PHASE-1-DEPLOY-RUNBOOK.md)
for the click-by-click Azure/Entra/Cosmos setup.
**Owner:** [to fill — app owner / program lead]
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
  User browser (index.html — unchanged UI, plus optional sign-in gate)
        │  answers → localStorage + scoring (client-side, as today)
        ▼
  First visit (managed deployment)
        ├─ /.auth/me (SWA) ──► signed-out / wrong-tenant / expired states
        └─ GET /api/profile ──► first-login (onboarding form)
                                │ POST /api/profile (displayName, language, consents)
                                ▼
                              ready (app opens) + optional explicit guest-data import
  Submit results
        ├─ (fallback, kept) Microsoft Form       …for small/unattended use
        └─ (primary, new)   HTTPS POST ──► Azure Static Web Apps
                                              │  auth callback (Entra ID)
                                              ▼
                                   Azure Functions API  (profile + submit)
                                              │  401/403/CSRF/429 enforced server-side
                                              ▼
                                   Azure Cosmos DB / SQL  (submissions/users/audit)
                                              │
                                              ▼
                                   Aggregation views → later Power BI (Phase 2)
```

Decisions to confirm before building (they affect consent wording and layout):

| Decision | Option A (recommended start) | Option B | **CHOSEN** |
|---|---|---|---|
| **Attribution** | Anonymous scores; optional non-PII label (e.g., "Business A") | Full Entra ID identity per user | **Option B — Entra ID identity, roles assigned by admin** |
| **Roles** | 1 role (Submitters) | Evaluator / Reviewer / Administrator | **Evaluator / Reviewer / Administrator** |
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
  - Enable **managed authentication** (Entra ID) — the app ships a
    `staticwebapp.config.example.json` with the required `auth` + `routes`
    + `globalHeaders`; fill in your tenant/client placeholders.
- **Azure Functions** (same SWA plan; separate `api/` endpoint or in-plan)
  - Endpoint: `POST /api/submit`, `GET|POST /api/profile`,
    `POST /api/profile/import`.
- **Data store:** Azure Cosmos DB (serverless), containers `submissions`,
  `users`, `audit` (databases `business-evaluator`).
- **Application Insights** (telemetry; no PII in logs).

### Step 4 — Enable Entra ID (Microsoft Entra) authentication (SWA managed)
- Register a SWA app and enable managed auth with **Azure AD / Entra ID**.
- Configure **custom roles** in the SWA config so `userRoles` arrive as
  `Evaluator` / `Reviewer` / `Administrator` (assign roles via security
  groups, not individuals, where possible).
- **No auto-admin bootstrap:** nobody becomes an Administrator by being
  first to sign in — administrators are assigned by an admin/group in Entra.
  A signed-in user with **no** recognized role gets a friendly
  "your access hasn't been set up yet" banner and can still use the tool
  locally.
- Deploy `staticwebapp.config.example.json` → `staticwebapp.config.json`:
  `routes` gate `*/api/*` behind the SWA `authenticated` virtual role, and
  the Functions enforce role checks **server-side** in addition (defence in
  depth — see Step 5).

### Step 5 — Build the submit + profile API
> **Status: implemented and unit-tested.** Working, tested code exists under
> `api/` — deploy and run `npm install` + `npm test` there. Remaining: standing
> up the real Azure resources and wiring the env vars.

New files only; no change to existing rendering/scoring logic.
- `api/` (Azure Functions, Node v4 `@azure/functions`, triggers `POST
  /api/submit`, `GET|POST /api/profile`, `POST /api/profile/import`):
  1. `api/src/auth.js` — **identity + security core.** Decodes the SWA
     `x-ms-client-principal` header; the identity key is `userId` and never
     falls back to `userDetails` (UPN) because UPNs can change. Provides
     `requireAuthenticated` (401), `requireRole` (403, roles Evaluator /
     Reviewer / Administrator), a CSRF envelope check (same-origin or
     allow-listed `Origin`), a tenant-claim check (`allowedTenantId`), an
     in-process rate limiter, and a sanitizing audit emitter (no tokens /
     cookies ever logged).
  2. `api/src/validate.js` — payload shape (exactly 8 categories, scores 0–5,
     bands `weakness|opportunity|strength|unanswered`, language
     `simple|standard`), plus size cap (10 KB) and field checks. Pure and
     dependency-free.
  3. `api/src/handler.js` — framework-agnostic request handling: 401
     anonymous, 403 wrong role / CSRF, 429 over the rate limit, 400 empty /
     invalid-JSON/bad-shape, 413 oversized, 202 for good submissions. Stamps
     `submissionId`, `submittedAt`, `schemaVersion: 1`, `principal.userId`.
  4. `api/src/store.js` — Cosmos DB persistence (`@azure/cosmos`); honors
     `COSMOS_CONNECTION_STRING` or `COSMOS_ENDPOINT`+`COSMOS_KEY`,
     `COSMOS_DATABASE` (default `business-evaluator`), `COSMOS_CONTAINER`
     (default `submissions`), `COSMOS_USERS_CONTAINER` (default `users`),
     `COSMOS_AUDIT_CONTAINER` (default `audit`). `createDataStore()` returns
     an in-memory dev store when `DEV_NO_STORE=true` or running under the
     Functions dev env; otherwise storage failure surfaces a 500 so nothing
     is silently dropped. `createMemoryStore()` supports tests.
  5. `api/src/profile-handler.js` — onboarding via `GET|POST
     /api/profile` (displayName ≤ 120 chars, language `simple|standard`,
     both consents must be true) and `POST /api/profile/import` (records an
     explicit, size-capped guest-data summary — disabled unless
     `ALLOW_IMPORTS=true`). Authenticated required, **no** role gate (a brand
     new Evaluator must be able to onboard before roles arrive).
  6. `api/src/functions/submit.js` + `api/src/functions/profile.js` — thin
     `app.http(...)` adapters that read the `x-ms-client-principal` header,
     inject store/log/audit, hold a **module-scope** rate limiter (so limits
     persist across requests), and map results to HTTP responses. Function
     `authLevel` is `anonymous` — SWA gates `/api/*` to `authenticated`,
     then the handlers enforce authentication, roles, CSRF, and rate limits
     **server-side** (defence in depth).
- Env vars reference (also in `api/local.settings.json.example`):
  `COSMOS_CONNECTION_STRING` | `COSMOS_ENDPOINT`+`COSMOS_KEY`,
  `COSMOS_DATABASE`, `COSMOS_CONTAINER`, `COSMOS_USERS_CONTAINER`,
  `COSMOS_AUDIT_CONTAINER`, `ALLOWED_ORIGINS`, `RATE_LIMIT_MAX`,
  `RATE_LIMIT_WINDOW_MS`, `ALLOW_IMPORTS`, `DEV_NO_STORE`.
- Tests: `api/test/submit.test.js` (27), `api/test/auth.test.js` (16),
  `api/test/profile.test.js` (13), `api/test/store.cosmos.test.js` (7) — plain
  Node (`npm test` in `api/`,
  no install needed) covering validation, auth, CSRF, rate limiting,
  store failure, profile onboarding, guest-import, Cosmos-config states, and
  the Cosmos document shapes (the store normalizes every item to carry an
  `id` — the `submissions`/`audit` writes derive one from the submission id
  or a generated UUID).
- Function auth (deployed): require the SWA-issued identity; do **not**
  expose the Functions endpoint directly. `x-ms-client-principal` is only
  trusted because SWA strips client-supplied copies in managed-auth mode.

### Step 6 — Wire the app's Submit button + managed gate
> **Status: done** — submit flow was already wired and smoke-tested; managed
> onboarding (`js/managed.js`) is implemented and unit-tested. Only the real
> `apiUrl` value and deployment env vars remain.

- In `js/data.js` add to `SUBMIT_FORM`:
  ```js
  apiUrl: ""   // e.g. "https://<swa>.azurestaticapps.net/api/submit"
  ```
- Managed deployments also set `MANAGED_ACCESS` in `js/data.js`:
  ```js
  MANAGED_ACCESS = { enabled: true, apiBase: "/api", authEndpoint: "/.auth/me",
    signInPath: "/.auth/login/aad", signOutPath: "/.auth/logout",
    allowedTenantId: "<tenant-id>", ... }
  ```
  `js/managed.js` then gates the shell behind SWA sign-in, runs one-time
  onboarding (display name, language, two consents) via `/api/profile`, and
  shows a banner with the identity + sign-out. Local/guest mode is untouched
  when `enabled: false` (the default).
- In `js/app.js`, `submitResults()` order of attempts:
  1. If `apiUrl` set → `fetch(apiUrl, {method:"POST", body})`; on success show
     "Your results were submitted". A failed request (non-2xx or network
     error) falls through to the form paths below, so collection is never
     blocked.
  2. Else if `prefillTemplate` set → pre-filled form (Phase 0 behavior).
  3. Else → clipboard + open `formUrl` (Phase 0 fallback).
- Payload shape (`buildSubmissionPayload()` in `js/app.js`):
  `{ language, categories: [{ id, label, score, band }] }` — matches
  `api/src/validate.js`.
- Keep the Microsoft Form path intact as the offline/unattended fallback
  (per the project's "do not remove existing capability" rule).

### Step 7 — Security & compliance controls
- HTTPS everywhere (SWA default). HSTS header on (`globalHeaders` in the SWA
  config example).
- **No secrets or tokens in the browser**: identity comes from SWA's
  `x-ms-client-principal` (trust anchor) and `/.auth/me`; `js/managed.js`
  never writes identity data to localStorage and never stores passwords.
- **Server-side enforcement regardless of client**: every endpoint checks
  authentication (401), role (403), CSRF envelope (403), and rate limit (429)
  before parsing bodies — the SWA routes gate is a convenience layer, not the
  control.
- CORS / cross-origin locked via `ALLOWED_ORIGINS` on the Functions.
- Rate limiting at the API: in-process sliding window via `RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS` (default 20/min for submit). **Temporary
  single-instance measure** — before horizontal scaling, adopt a durable
  limiter (Redis Cache, Cosmos, or the App Gateway WAF).
- Data at rest: Cosmos default encryption.
- Audit trail: `submit.accepted` / `submit.denied` / `profile.*` events in
  the `audit` container; entries are sanitized (no tokens, cookies, or full
  payloads).
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
- Full rollout to the target group(s); assign the **Evaluator** role (and
  Reviewer/Administrator as needed) via security groups in Entra so uninvited
  users can't submit or read the collected data.
- All users can onboard (any authenticated person gets the app locally after
  sign-in) but only role-holders can submit results.
- Retire the Microsoft Form path only after the API path is stable for 1+.

### Step 11 — Straight-line to Phase 2 (later)
- Once submissions accumulate: Power BI dataset over the Cosmos container →
  benchmark/industry comparisons and over-time trends (the README roadmap
  items). Needs the data model agreed in Step 2; no re-architecture.

### Step 12 — Document analyzer, backend offload (optional, later)
- Today the optional document analyzer runs **on-device** (`ANALYZE.provider`
  = `"wllama"`): the document never leaves the browser and the model is
  downloaded once and cached. This is the privacy-preserving default and needs
  no infrastructure.
- If a larger/hosted model is ever wanted, `js/analyzer.js` already exposes an
  `"api"` provider (set `ANALYZE.provider` + `ANALYZE.apiUrl`). That path
  **would** send document text to a server, so it must go through the same
  approval gate as the submission API (data model, retention, consent) before
  being enabled. Until then, keep `provider: "wllama"`.

---

## 3. What does NOT change

- Question content, scoring bands, both language wordings.
- The `.txt` export and local persistence.
- The static, dependency-free rule for the *front end* (no framework added),
  with the single documented exception of the vendored `@wllama/wllama`
  engine used by the optional on-device document analyzer.

---

# Part 2 — Data-privacy note (for the approval gate)

> Fill the bracketed `[ ]` fields; remove the note's instructions once done.
> Target audience: IT security / privacy / procurement reviewers.

### 1. Purpose
- The tool runs a business self-evaluation: users answer 8 categories of
  1–5 rating questions, get per-category strengths/weaknesses/opportunities,
  and receive tailored recommendations.
- Users may voluntarily submit their anonymized results so [ORG] can
  understand capability gaps and target support/benchmarking. Submission is
  **optional**; using the evaluation itself never requires it.

### 2. What is collected
- Per-category numeric scores (8 values), computed score band, which language
  wording was used, timestamp of submission.
- **Chosen: sign-in identifier (Entra ID object id / `sub` only — never the
  UPN/email as the key)** so results can be attributed and reviewed by role.
  A minimal onboarding profile (display name, language preference, two
  consents) is stored per user. Notably **no password and no account tokens
  are ever stored in the browser**.
- Optional approved label (e.g., "Business A") if the org permits
  de-identification instead of full identity — if adopted, only the label is
  stored.
- No payment, location, biometric, or health data.
- Client-side answers (`localStorage`) are the user's own data and never
  transmitted unless they press “Submit results” (or explicitly link device
  data to their account — a summary record only).

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
  (“By submitting, you agree that [ORG] stores these results for
  24 months to improve support and benchmarking”). Managed deployments
  additionally collect an explicit two-part consent during onboarding
  (data processing + sharing anonymous results with advisors).
- Users can withdraw: deletion request via [CONTACT] processed within
  [30] days.

### 6. Security controls
- Transport: HTTPS/HSTS only.
- Authentication: required Entra ID sign-in for managed deployments
  (SWA managed auth); roles **Evaluator / Reviewer / Administrator** assigned
  by administrators — no first-visitor admin bootstrap.
- API: server-side validation, size caps, CSRF envelope, rate limiting,
  CORS allow-list; roles enforced in the Function handlers, not just the SWA
  routes.
- No secrets in front-end code and no tokens persisted in the browser;
  Functions validate identity from the SWA-provided principal header before
  storing.
- Audit events (accept/deny/onboarding) written to a sanitized Cosmos
  `audit` container; Application Insights logs exclude PII.
- Encryption at rest (Cosmos default); monitoring alerts on abnormal submit
  failures/volumes.

### 7. Third-party/processor & DPIA
- Microsoft (Azure/M365) is the processor — [ORG] remains controller.
- Because the chosen model includes **named attribution (Entra ID identity)**
  and onboarding profile data, a **DPIA is recommended** before rollout.

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
2. Provision the Azure resources from Step 3 (SWA + Functions + Cosmos +
   App Insights) and the Entra ID / custom-role setup from Step 4.
3. Wire the real env vars (Step 5 reference) and set
   `MANAGED_ACCESS.enabled = true` + real `apiUrl` in `js/data.js`.
4. Submit §Part-2 note with the Phase 1 steps for the approval gate.