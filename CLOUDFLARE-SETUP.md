# Cloudflare Pages + Functions Setup Guide

The `business-evaluator` app now runs entirely on Cloudflare:
- **Cloudflare Pages** hosts the static site (`index.html`, `css/`, `js/`).
- **Cloudflare Pages Function** (`functions/api/submit.js`) handles `POST /api/submit`.
- **Cloudflare KV** stores submissions.

This guide is the manual, one-time setup. A Cloudflare CLI check is below, but
you may also do everything in the dashboard.

---

## 1. Prerequisites

- A Cloudflare account (free is fine). If you don't have one:
  https://dash.cloudflare.com/sign-up
- Your GitHub repo: https://github.com/marequiron/business-evaluator
- Node.js already installed (v18+).

## 2. Connect GitHub to Cloudflare Pages

1. Log in at https://dash.cloudflare.com
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Authorize Cloudflare to access your GitHub account
4. Pick the `business-evaluator` repo
5. **Build settings:**
   - **Framework preset:** None (no build step)
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`  ← serves the repo root
6. Click **Save and Deploy**

After the first deploy, the site is live at something like:
`https://business-evaluator-<hash>.<subdomain>.pages.dev`

> The `functions/` folder is auto-detected — no build config needed for the API.

## 3. Create the KV namespace & bind it

The submit function writes to a KV binding named `SUBMISSIONS_KV`. Create it and
attach it to the Pages project:

1. Dashboard → **Workers & Pages** → **KV**
2. **Create a namespace** → name it `SUBMISSIONS` → **Add**
3. Back on your **Pages project** → **Settings** → **Functions** → **KV namespace bindings**
4. **Add binding**:
   - **Variable name:** `SUBMISSIONS_KV`
   - **KV namespace:** select `SUBMISSIONS`
5. **Save**

(If you prefer CLI: `npx wrangler kv namespace create SUBMISSIONS` then
`npx wrangler pages project bind <PROJECT> --kv-namespace SUBMISSIONS`.)

## 4. Authorize the Worker to use `crypto.randomUUID()`

Cloudflare Workers have built-in `crypto.randomUUID()` on modern runtimes — no
extra configuration needed for the current decompile. If your runtime is older,
set `compatibility_date` in `wrangler.toml` to a recent value.

## 5. Set environment variables (optional)

Under **Pages project → Settings → Environment variables**, you can set:

- `REQUIRE_AUTH` — set to `true` to gate submits (returns 403 for everyone;
  see note below). Leave unset (`false`) for open anonymous submissions.
- `ENVIRONMENT` — set `production` in Production, `development` elsewhere.

> **Auth note:** Cloudflare Pages has built-in Access (allow/deny at the page
> level), which is the right way to gate who can reach the app at all — better
> than the function-level `REQUIRE_AUTH` flag, which has no real identity
> lookup. For an internal tool, use **Cloudflare Access** on the project's
> domain and leave `REQUIRE_AUTH` unset.

## 6. Verify

After deploying, test the API:

```powershell
$body = @{
  language = "simple"
  categories = @(
    @{ id="finance"; label="Finance"; score=4; band="strength" }   # x5 more...
  )
} | ConvertTo-Json

# Replace <URL> with your pages.dev URL
Invoke-RestMethod -Method Post -Uri "https://<URL>/api/submit" -ContentType "application/json" -Body $body
```

Expect a `202` response with an `id`. Then open the site in a browser, answer
questions, click **Submit results** — it should post to the API and show
"Your results were submitted."

## 7. Local development

```powershell
npm test          # runs the 11 Cloudflare function tests
npm start         # serves the static site locally (API won't be live locally)
```

For a fully local run with the function, install wrangler and add your KV
namespace id to `wrangler.toml`:
```powershell
npx wrangler pages dev .
```

---

## Structure reference

```
business-evaluator/
├── functions/
│   └── api/
│       └── submit.js      # POST /api/submit (Cloudflare Pages Function)
├── css/, js/, index.html  # static site (published as-is)
├── wrangler.toml          # local dev config (KV binding reference)
└── test/
    └── submit-cf.test.mjs # 11 unit tests (Node built-ins only)
```
