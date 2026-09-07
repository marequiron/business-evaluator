# Cloudflare Deployment Setup Guide (Workers + Static Assets)

The `business-evaluator` app runs on Cloudflare Workers using the current
**static-assets** model:

- **Static site** lives in `public/` (`index.html`, `css/`, `js/`) and is
  uploaded as Worker assets.
- **API** is `functions/api/submit.js`, precompiled into `dist/worker/index.js`
  (committed) and set as the Worker's `main` — so `POST /api/submit` works.
- **KV** (`SUBMISSIONS_KV`) stores submissions; the binding is added in the
  dashboard.

Why this setup: the Cloudflare dashboard provisions this repo as a "Static
Framework" Worker connected to GitHub and deploys with `npx wrangler deploy`.
`wrangler.jsonc` points assets at `public/` so `node_modules` and source
folders never enter the 25 MiB asset bundle.

---

## 1. Prerequisites

- A Cloudflare account (free is fine). If you don't have one:
  https://dash.cloudflare.com/sign-up
- Your GitHub repo: https://github.com/marequiron/business-evaluator
- Node.js installed (v18+).

## 2. Connect GitHub to Cloudflare

1. Log in at https://dash.cloudflare.com
2. Left sidebar → **Workers & Pages** → **Create** (or your existing
   `business-evaluator` Worker project) → connect to the GitHub repo.
3. Deploy automatically runs `npx wrangler deploy` on push to `main`. No build
   command is needed — the compiled Worker (`dist/worker/index.js`) and static
   site (`public/`) are both committed.

After the first deploy, the site is live at:
`https://business-evaluator.<subdomain>.workers.dev`

## 3. Create the KV namespace & bind it

The submit function writes to a KV binding named `SUBMISSIONS_KV`:

1. Dashboard → **Workers & Pages** → **KV** → **Create a namespace** → name it
   `SUBMISSIONS` → **Add**.
2. On the **Worker project** → **Settings** → **Bindings** → **Add binding** →
   **KV namespace**:
   - **Variable name:** `SUBMISSIONS_KV`
   - **KV namespace:** select `SUBMISSIONS`
3. **Save**, then redeploy or wait for the next deploy.

> The `wrangler.jsonc` deliberately has **no** KV binding id — a placeholder id
> committed to the repo breaks `wrangler deploy`. Configure the binding in the
> dashboard only.

## 4. Set environment variables (optional)

On the **Worker project → Settings → Variables and Secrets**:

- `REQUIRE_AUTH` — set to `true` to gate submits (returns 403 for everyone;
  see note below). Leave unset (`false`) for open anonymous submissions.
- `ENVIRONMENT` — set `production` in Production, `development` elsewhere.

> **Auth note:** the right way to gate who can reach the app is **Cloudflare
> Access** on the project's domain (allow/deny at the edge). Prefer that over
> the function-level `REQUIRE_AUTH` flag, which has no real identity lookup.

## 5. Verify

After deploying, test the API:

```powershell
$body = @{
  language = "simple"
  categories = @(
    @{ id="finance"; label="Finance"; score=4; band="strength" }   # x5 more...
  )
} | ConvertTo-Json

# Replace <URL> with your workers.dev URL
Invoke-RestMethod -Method Post -Uri "https://<URL>/api/submit" -ContentType "application/json" -Body $body
```

Expect a `202` response with an `id`. Then open the site in a browser, answer
questions, click **Submit results** — it should post to the API and show
"Your results were submitted."

## 6. Local development

```powershell
npm test              # 14 tests: function unit tests + compiled-bundle smoke test
npm start             # serves public/ locally (API won't be live locally)
npm run build:worker  # recompile functions/ -> dist/worker/index.js (commit the result)
```

For a fully local run with the function, use wrangler with a real KV namespace
id (from **dashboard → KV → SUBMISSIONS → Settings**):
```powershell
npx wrangler dev --kv SUBMISSIONS_KV=<namespace-id>
```

## 7. Editing the API later

Any change to `functions/api/submit.js` must be recompiled and committed, or
the deployed Worker (which runs `dist/worker/index.js`) stays stale:

```powershell
npm run build:worker   # regenerates dist/worker/index.js
node test/compiled-worker.test.mjs   # smoke-test the bundle
git add dist/worker/index.js && git commit && git push
```

CI also rebuilds the bundle and fails if the committed `dist/worker/index.js`
doesn't match the current `functions/` source.

---

## Structure reference

```
business-evaluator/
├── wrangler.jsonc          # Workers static-assets config (committed)
├── public/                 # static site — the only thing uploaded as assets
│   ├── index.html
│   ├── css/
│   └── js/
├── functions/
│   ├── _middleware.js   # adds Cache-Control: no-store to every response
│   └── api/
│       └── submit.js       # POST /api/submit (source of the Worker)
├── dist/worker/index.js    # compiled Worker (committed; run by wrangler deploy)
├── test/
│   ├── submit-cf.test.mjs      # 11 function unit tests
│   └── compiled-worker.test.mjs # 3 bundle smoke tests
└── api/                    # legacy Azure reference (not deployed)
```

The `SUBMISSIONS_KV` binding lives only in the Cloudflare dashboard (Worker →
Settings → Bindings) — no binding id in the repo.