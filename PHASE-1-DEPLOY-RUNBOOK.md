# Phase 1 Deployment Runbook — Managed Evaluator (Azure Static Web Apps + Entra ID)

Step-by-step guide to deploy the **managed mode** (Entra ID sign-in + onboarding +
role-gated submission) described in `PHASE-1-PLAN.md`. Everything here maps 1:1
to the implemented code and tests in `api/` and `js/managed.js`, so completing
this runbook is the only remaining step to go live.

Estimated time: **1–2 hours** the first time (Entra + Cosmos are the slow parts).

---

## 0. Prerequisites + ownership

| Item | Owner |
|---|---|
| Azure subscription (pay-as-you-go/EA) | [ ] |
| Microsoft Entra ID admin (create app registration, groups) | [ ] |
| GitHub repo `business-evaluator/` (this code) | [ ] |
| Approval gate sign-off (per `PHASE-1-PLAN.md` §Part-2 note) | [ ] |
| Decide: `ALLOW_IMPORTS` (guest data-link) **on**/**off** (default **off**) | [ ] |

Decisions already made (see `PHASE-1-PLAN.md` Step 2):
attribution = **Entra ID identity**; roles = **Evaluator / Reviewer / Administrator**;
storage = **Cosmos DB (SQL API)**; deployment = **GitHub → SWA**. Region: **East US** (change if org policy differs).

> Always run the tests before and after wiring anything:
> ```
> npm test             # root: analyzer/scoring/smoke/managed/serve
> cd api && npm test   # 63 tests: submit/auth/profile/store.cosmos
> ```

---

## 1. Prerelease checks on the code (5 min)

1. Confirm the repo is the latest tested baseline (all suites green — see above).
2. Confirm `api/src/functions/*.js` use Function `authLevel: "anonymous"` **and**
   the handlers enforce auth/roles/CSRF/limits server-side (they do today; keep
   it that way — SWA routes are a convenience layer, not the control).
3. Confirm the shipped default stays **off**: `js/data.js` has
   `MANAGED_ACCESS.enabled: false` and `SUBMIT_FORM.apiUrl: ""`. You will flip
   both **only in the deployment step** (§6) — never in the committed baseline
   unless you intend every environment to be managed.

---

## 2. Create Cosmos DB (account → database → containers)

1. Azure portal → Create a resource → **Azure Cosmos DB** → API: **Core (SQL)**.
   - Resource group: `rg-business-evaluator` (East US).
   - Capacity mode: **Serverless** (fine for this scale; switch to Provisioned
     if you later need throughput guarantees).
2. Create the database + 3 containers (partition key **must** match the code):

| Container | Partition key | Why this key (code contract) |
|---|---|---|
| `submissions` | `/id` | every submission doc gets `id = submissionId`; written via `items.create()` |
| `users` | `/id` | doc `id = userId`; read via `item(userId, userId)`, write via `upsert()` |
| `audit` | `/id` | each audit entry gets a generated `id`; written via `items.create()` |

   Note: the code defaults to database `business-evaluator` and these 3 names.
   If you rename any, set the matching app settings in §5.
3. Copy the **primary connection string** (Settings → Keys) → you'll paste it as
   `COSMOS_CONNECTION_STRING` in §5. (Alternative: `COSMOS_ENDPOINT` + `COSMOS_KEY`.)

---

## 3. Configure Microsoft Entra ID (app registration)

1. **Microsoft Entra admin center → App registrations → New registration.**
   - Name: `business-evaluator-coach`.
   - Supported account types: **Accounts in this organizational directory only**.
   - Redirect URI (Web): `https://<swa-domain>/.auth/login/aad/callback`
     — you may not know `<swa-domain>` until §4; add the URI after SWA is
     created (or use the generate-nonce flow after §4.2).
2. **Certificates & secrets** → New client secret (e.g. 12 months) → copy the
   **value now** (shown once). This becomes `AZURE_CLIENT_SECRET` (§4).
3. Note the **Application (client) ID** → becomes `AZURE_CLIENT_ID` (§4).
   Note the **Directory (tenant) ID** → becomes `allowedTenantId` (§6) and the
   `openIdIssuer` placeholder (§4.4).

### Roles — how Evaluator / Reviewer / Administrator reach the API

The Functions only trust roles that arrive in the SWA `x-ms-client-principal`
`userRoles` with the **exact** names `Evaluator`, `Reviewer`, `Administrator`.
Choose one way to supply them (exact mechanism varies slightly by tenant — the
safety net is that a user with no role still gets the app, just without submit):

- **Option A (recommended): App roles on the registration.**
  - App registration → **App roles** → create 3 roles with values exactly
    `Evaluator`, `Reviewer`, `Administrator` (assignable to: users/groups/service
    principals).
  - Assign members to app roles via **Enterprise application → Users and groups**
    (ideally via the security groups below).
- **Option B: Security groups → role names via claims.**
  - Create Entra groups `Coach Evaluators`, `Coach Reviewers`, `Coach
    Administrators`; add members.
  - Configure the registration/app to emit group claims such that SWA surfaces
    them as role names. Confirm what your tenant emits in `userRoles` (see the
    verification step in §7, "role chip"), and align the exact names.
- **Verify against current Microsoft docs** before rollout — the role/claim
  surface for static web apps with Entra changes occasionally:
  https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization
  and the group/role assignment guidance linked from it.

Do **not** set up any "first visitor becomes administrator" flow — the code has
no such bootstrap and administrators are always assigned here.

---

## 4. Create the Azure Static Web App

1. Portal → **Create a resource → Static Web App**.
   - Plan/Free Tier: **Standard** (required for managed auth).
   - **Deployment details:** connect GitHub, select the repo incl. `api/`.
2. **Build details:**
   - App location: `/`
   - API location: `api`
   - Output location: *(leave empty — static files are already at repo root)*
   - Build preset: **Custom** with empty/`npm ci` build command (no bundler).
   - First build may deploy `MANAGED_ACCESS.enabled: false` — that is fine;
     you flip it in §6 and redeploy.
3. After creation, copy the **default domain** `https://<random>.azurestaticapps.net` =
   `<swa-domain>`. If you added a custom domain, use that. Add the web redirect
   URI from §3.1 in the Entra app now.
4. **Enable managed authentication:**
   - SWA resource → **Authentication** → *ID Provider*: **Microsoft Entra ID** —
     switch auth **ON** (`Authenticate requests` → managed).
   - Provide the Entra **Application (client) ID** and **client secret**.
     (This stores the secret in SWA; the values are referenced by the config
     file so nothing appears in the repo.)
5. **Create the SWA config file** (root of the repo, committed):
   - Copy `staticwebapp.config.example.json` → `staticwebapp.config.json`.
   - Replace `https://login.microsoftonline.com/<your-tenant-id>/v2.0` with the
     real issuer for your tenant ID.
   - Keep `clientIdSettingName: "AZURE_CLIENT_ID"` /
     `clientSecretSettingName: "AZURE_CLIENT_SECRET"` — then set those two
     names in SWA **Application settings** (§5) with the actual values.
   - The routes already gate `*/api/*` to the `authenticated` role and the
     `401 → /.auth/login/aad` override is already set.

---

## 5. SWA Application settings (env vars for the Functions)

SWA resource → **Configuration → Application settings** → add (all keys
uppercase, exactly as in `api/src/*`):

| Setting | Value |
|---|---|
| `COSMOS_CONNECTION_STRING` | primary connection string from §2 (or use `COSMOS_ENDPOINT` + `COSMOS_KEY`) |
| `COSMOS_DATABASE` | `business-evaluator` (or rename) |
| `COSMOS_CONTAINER` | `submissions` |
| `COSMOS_USERS_CONTAINER` | `users` |
| `COSMOS_AUDIT_CONTAINER` | `audit` |
| `ALLOWED_ORIGINS` | `https://<swa-domain>` (comma-separated if more) |
| `RATE_LIMIT_MAX` | `20` (submissions/min per user) |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `ALLOW_IMPORTS` | `false` (set `true` only when the product approves the guest data-link) |
| `AZURE_CLIENT_ID` | Entra Application (client) ID from §3.3 |
| `AZURE_CLIENT_SECRET` | Entra client secret value from §3.2 |

> Do **not** set `DEV_NO_STORE` here — that is dev-only. Storage failure must
> surface as a 500, never a silent no-op.
>
> Rate limiting is **in-process** (temporary, single-instance). The plan's Step 7
> requires a durable limiter before you scale horizontally — see §9.

Workload identity (Functions ↔ Cosmos) is simplest via the connection string. If
your org prefers managed identity, switch to `COSMOS_ENDPOINT` + `COSMOS_KEY`
(then audit/prod), and consider RBAC — note that out of scope for the first cut.

---

## 6. Switch the app into managed mode

In the **deployment branch**, edit `js/data.js`:

```js
const MANAGED_ACCESS = {
  enabled: true,
  apiBase: "/api",                       // same-origin — leave as-is
  authEndpoint: "/.auth/me",             // SWA — leave as-is
  signInPath: "/.auth/login/aad",        // SWA — leave as-is
  signOutPath: "/.auth/logout",          // SWA — leave as-is
  allowedTenantId: "<your-tenant-id>",   // from §3.3 (tenant pin)
  displayNameMax: 120,
  importMaxBytes: 524288,
  languages: [
    { value: "simple", label: "Plain language" },
    { value: "standard", label: "Standard wording" }
  ],
  recognizedRoles: ["Evaluator", "Reviewer", "Administrator"],
  allowGuestImport: false                // set true only if §0 approved
};

const SUBMIT_FORM = {
  apiUrl: "https://<swa-domain>/api/submit",   // real endpoint
  embedUrl: "",
  formUrl: "",                                  // keep if you want the form fallback
  prefillTemplate: ""
};
```

Commit + push → SWA redeploys. The UI won't change for anonymous users *yet*
(the gate replaces the shell), so visually confirm via §7.

> To keep the committed baseline offline while only the deployed environment is
> managed, you can instead inject these values at build time (a small
> `enable-managed.mjs` that rewrites a build output copy). For a single managed
> deployment, the direct edit above is the simplest supported path; just
> remember it is intentional and is reverted on rollback (§10).

---

## 7. Verify (end-to-end, first-time user)

1. **API landed:** `GET https://<swa-domain>/api/profile` (no sign-in) →
   expect the SWA `401` → redirect to `/.auth/login/aad` (or a 401 JSON if the
   function responds). If you get a 404 page, the Functions didn't register
   (check §4.2 `api` location + §5 settings) — fix before anything else.
2. **First-time sign-in (this is the exact flow `js/managed.js` gates):**
   - Open the site in an incognito/private window → you should see **"Sign in
     to continue"**.
   - Click **Sign in with your organization account** → Entra login.
   - Land on **"Let's set up your space"** onboarding — enter display name,
     pick language, tick **both** consents, **Continue**.
   - App opens with the **"Signed in as …"** banner.
3. **Role check:** the banner chip should show one of Evaluator / Reviewer /
   Administrator (or the unassigned note). Inspect raw claims by visiting
   `https://<swa-domain>/.auth/me` in the same browser — confirm
   `clientPrincipal.userRoles` carry the exact role names. Anything else shows
   up as "No review role yet" — safe, but submit will 403 server-side.
4. **Submit reaches Cosmos:** complete an assessment → **Submit results** →
   confirm:
   - `submissions` container has a doc with `id`, `principal` = the user ID,
     and the 8 categories;
   - `users` container has a doc with `id` = `userId`, displayName/language/
     consents; and
   - `audit` container has `submit.accepted` and `profile.saved` events.
5. **Negative-path sanity (optional but quick):** in the same private session,
   a second user with **no** role sees the unassigned banner and submit returns
   `403 {"error":"forbidden","detail":"missing_required_role"}`.
6. **Rate limiter:** from one signed-in user, fire > 20 submits/min → expect
   `429` with `Retry-After`.

If any step misbehaves, keep the session open and share the `/.auth/me` payload
and the offending HTTP status — that distinguishes SWA routing issues from
Functions issues.

---

## 8. Checking-in with the local mock

The repo ships `npm run mock:auth` (a local SWA/Entra simulator) so you can demo
the first-time flow and every gate state (wrong-tenant, unassigned, expired,
guest-import) with zero cloud. Use it for training captures and change-guard work
— the real environment re-validates only §7.

For a **real sign-in dry-run without Azure**, use `npm run auth:github`: a local
SWA-equivalent that redirects to the real GitHub OAuth login and then runs the
real `api/src` handlers for `/api/profile` and `/api/submit` (onboarding, CSRF,
rate limit, role gate, audit — all production code; only storage is in-memory).
Setup (one time, no admin): create a GitHub OAuth App (Homepage
`http://127.0.0.1:4174/`, callback `http://127.0.0.1:4174/auth/github/callback`),
place the client id/secret in env or a gitignored `scripts/.github-oauth.json`,
and map your GitHub username → roles in `scripts/github-roles.local.json` (copy
`github-roles.sample.json`; unmapped users see the safe "unassigned" banner).
This validates the same first-time saga the checklist in §7 describes, minus the
Entra-only states (wrong-tenant/expired) that only the §8 mock or real Entra can
exercise.

---

## 9. Post-deploy operations

- **Monitoring:** enable Application Insights on the SWA (Functions logs).
  `api/src/auth.js` writes audit entries to the logger *and* the `audit`
  container — sanitized (no tokens/cookies/payloads). Find anomalies there.
- **Durable rate limiting (before scale-out):** the current limiter is in-process.
  Move to Redis Cache / Cosmos-backed or App Gateway WAF **before** more than
  one instance can serve traffic.
- **Patching:** keep `@azure/cosmos` and `@azure/functions` current; add
  `api/package-lock.json` for reproducible installs.
- **Retention:** decide Cosmos TTL/backup policy. Serverless accounts can be
  restored; document the retention you promised in the consent wording (Phase-1
  plan §3 says "stored … for 24 months" — mirror that in the Cosmos TTL if you
  have a number).

---

## 10. Rollback

Fastest functional rollback (keeps data):
1. In `js/data.js` → `enabled: false`, `apiUrl: ""` → commit/push → app returns
   to the offline/guest default for everyone; Cosmos data is untouched.
2. Optional: delete `staticwebapp.config.json`'s `routes` auth gate (or turn off
   SWA managed auth) — no need if step 1 removed the gate.

Full teardown (data loss): delete the SWA resource + the Cosmos account
+ remove the Entra registration.

---

## Placeholders to still fill

`<your-tenant-id>`, `<swa-domain>`, `<client-secret>`, resource group name,
retention months, rollback contact. Keep them out of Git (Application settings
are Azure side; `clientSecret` lives only in SWA/Entra).

---

## References
- SWA auth/roles: https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization
- SWA config file: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
- SWA Functions: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions
- Cosmos SQL API: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/