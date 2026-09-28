# Security Review — Business Self-Evaluation Tool

Reviewed: 2026-09-24 (updated 2026-09-25 for managed auth)
Scope: root static app (`index.html`, `js/`, `css/`), `serve.js`, Tauri config, `api/` (gated, not deployed). The `app/` folder is an unrelated unshipped Vite template and was **not** reviewed in depth.
Method: code inspection + automated tests (`test/serve.test.js`, `test/managed.test.js`, existing `npm test`, `api` tests) + `npm audit` (root & `app/`). Nothing is marked "fixed" unless a test or direct inspection confirms it.

## Status summary

| ID | Severity | Location | Status | Detail |
|----|----------|----------|--------|--------|
| SRV-01 | Medium | `serve.js:57` (old) | **Fixed** | Dev server bound to all interfaces (`server.listen(port)` → `0.0.0.0:4173`), reachable from the LAN. Now defaults to `127.0.0.1`; `HOST` env overrides deliberately. |
| SRV-02 | Medium | `serve.js:37` (old) | **Fixed** | `decodeURIComponent(req.url)` could throw on malformed `%` sequences, crashing the whole server (recoverable DoS). Now wrapped → HTTP 400; server keeps serving (tested). |
| SRV-03 | Low | `serve.js:37` (old) | **Fixed** | Traversal guard used `filePath.startsWith(root)` — a Windows prefix bug (`C:\project` vs `C:\projectevil`) and a directory redirect point was checked only once. Now `path.relative(root, filePath)` is used and re-checked after directory resolution; escapes return 403 (tested). |
| SRV-04 | Low | `serve.js` (all) | **Fixed** | No security headers on responses. Now sets CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`; `Server` banner absent (tested). CSP mirrors the Tauri config allowances (`wasm-unsafe-eval` for the analyzer, HF connect-src). |
| FE-01 | Low | `js/app.js:1413` `importBackupFile` | **Fixed** | Backup import read files of unbounded size. Now capped at 5 MB before reading. `importAll()` already rejects non-Coach JSON (marker check) and every restored field is sanitized in `js/storage.js`. |
| FE-02 | Info | `js/app.js`, `storage.js`, `data.js` | **Verified safe** | No `innerHTML` sinks with user/imported content (rendering is `textContent`-based), no `eval`/`new Function`/`document.write`/`window.open` in the app. `SUBMIT_FORM` URLs are empty and unused (feature dormant). |
| TAURI-01 | Info | `src-tauri/tauri.conf.json` | **Verified safe** | Strict CSP already configured (`'wasm-unsafe-eval'` for the on-device LLM, pinned `connect-src` incl. Hugging Face). No change needed. |
| API-01 | Info | `api/src/*`, `functions/*` | **Not deployed (gated)** | Now includes: mandatory `x-ms-client-principal` identity, role gate (401/403), CSRF envelope, in-process rate limiting, profile onboarding endpoints, audit trail. See `PHASE-1-PLAN.md`. |
| MNG-01 | Info | `js/managed.js` (new) | **Implemented** | Optional sign-in gateway (`MANAGED_ACCESS.enabled`). No identity/token storage in localStorage; gate blocks the shell until onboarding completes; sign-out navigates to `/.auth/logout`. |
| MNG-02 | Info | `api/src/auth.js` (new) | **Implemented** | `userId` never falls back to `userDetails` (UPN) — fixes the old `parsePrincipal` in `functions/submit.js`. Secrets never logged (sanitizer tested). |
| DEPS-01 | Info | `package.json` (root & `app/`) | **Verified safe** | `npm audit` (prod + dev): 0 vulnerabilities in both. |
| GIT-01 | Info | `.gitignore`, `api/.gitignore` | **Verified safe** | Covers `node_modules/`, `*.log`, `src-tauri/target/`, `src-tauri/app-dist/`, `api/local.settings.json`. No secrets exist server-side; no `.env` is used by the static app. |

## What was changed (2026-09-25 — managed auth)

### `api/src/auth.js` (new)
- `parsePrincipal()` decodes the SWA `x-ms-client-principal` header (URL-safe
  base64 tolerated), prefers `decoded.userId` → `sub` → claims `oid`/`sub`,
  and **never** falls back to `userDetails` for the identity key.
- `requireAuthenticated()` (401) and `requireRole()` (403) gate every
  endpoint; roles are `Evaluator` / `Reviewer` / `Administrator`.
- `checkRequestEnvelope()` CSRF check: safe methods pass; state-changing
  requests must be same-origin (Sec-Fetch-Site) or carry an allow-listed
  `Origin` (`ALLOWED_ORIGINS`, `*` supported).
- `createRateLimiter()` — **temporary, in-process** sliding window. Does not
  coordinate across instances; a durable limiter is required before scaling
  out (documented in `PHASE-1-PLAN.md`, Step 7).
- `sanitizeMeta()` + `createAuditor()`: audit entries never carry tokens,
  cookies, or authorization headers; writes to the logger and optionally to a
  Cosmos `audit` container.

### `api/src/store.js` (extended)
- `createDataStore(env)` exposes `storeSubmission`, `getProfile`,
  `saveProfile`, `saveGuestImport`, `saveAuditEvent` against Cosmos
  (`users`/`audit` containers). `createMemoryStore()` backs tests/dev.
- **Cosmos document normalization:** every item written is stamped with an
  `id` (submission id or generated UUID) so the `/id` partition-key shape
  holds — fixes a defect where a real Cosmos write would 500 on a missing
  `id` (covered by `api/test/store.cosmos.test.js`).
- `createStore()` kept for backward compatibility.

### `api/src/handler.js` (hardened)
- Auth is now **mandatory**: anonymous → 401, no submit role → 403, CSRF
  rejection → 403, over the limit → 429 `Retry-After`. 401/403/429 fire
  before any payload parsing.
- Old `REQUIRE_AUTH` / `SUBMITTER_ROLE` opt-in bypass removed.

### `api/src/functions/submit.js` + `api/src/functions/profile.js`
- Submit adapter uses the shared `parsePrincipal`, passes a module-scope rate
  limiter (so it actually persists across requests) and an auditor.
- New `/api/profile` (GET/POST onboarding) and `/api/profile/import`
  (explicit guest-data import; disabled unless `ALLOW_IMPORTS=true`).

### `staticwebapp.config.example.json` (new, repo root)
- Route `*/api/*` requires the SWA `authenticated` virtual role; Entra ID
  provider config with `<placeholders>`; CSP / HSTS-class headers; 401 →
  `/.auth/login/aad` redirect. Gated further by the function-side role checks.

### Front end
- `js/data.js` → `MANAGED_ACCESS` config (enabled defaults `false`).
- `js/managed.js` (new, self-initializing): states `loading / signed-out /
  wrong-tenant / expired / first-login / unassigned / profile-failure /
  unavailable / ready`; onboarding form (displayName, language, both
  consents); explicit one-time guest-import offer; sign-out control. Never
  writes identity or tokens to localStorage. Does nothing when disabled.
- `test/managed.test.js` (new): 11 jsdom tests covering every state.

### API tests
- `api/test/auth.test.js` (16) + `api/test/profile.test.js` (13) + expanded
  `api/test/submit.test.js` (27) + `api/test/store.cosmos.test.js` (7; pins
  the Cosmos document shapes — every item carries an `id` for partition key
  `/id`, derived from the submission id or a generated UUID) — all run under
  `npm test` in `api/` (63 total).

## Controls verified by test or inspection
- Localhost-only binding — spawn test + socket inspection (bound `127.0.0.1`, LAN not reachable).
- Header policy — assertion on every response.
- Malformed-URL & traversal rejection — behavioral tests.
- Backup import size cap — code inspection (`app.js:1413`).
- No unsafe DOM sinks — grep across `js/` (only a documentation comment mentions `innerHTML`).
- No known vulnerable dependencies — `npm audit` clean.
- Managed auth: 401/403/429/CSRF behavior, rate limiter ceiling, tenant pin,
  audit sanitization, and all managed.js UI states — automated tests.

## Not addressed (deliberately out of scope)
- `api/` deployment (not deployed; gated behind approval).
- Authentication for the static app itself by default (single-user local tool
  by design; opt-in managed mode ships ready but disabled).
- HTTPS (no certificate infra locally).
- Durable/multi-instance rate limiting (accepted for now; see plan Step 7).