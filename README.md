# Business Self-Evaluation Tool

A zero-install, single-page web app that helps a business owner:
1. Answer 1-5 rating questions across 8 categories (Finance, Marketing &
   Sales, Operations, People, Technology, Customer Experience, Strategy,
   Legal & Compliance).
2. Automatically see which categories are **Strengths**, **Weaknesses**, or
   **Opportunities to explore**.
3. Get a tailored, plain-language recommendation for every category.
4. Switch between **simple** (default) and **standard** wording.
5. Export results as a text file, or print / save as a PDF.
6. Track changes over time: every evaluation is auto-saved as a snapshot,
   with compare, delete, and JSON export/import.
7. Submit results to a Microsoft Form (opt-in) so leadership can
   collect/aggregate them.

Everything runs client-side in the browser — no server, no database, no
accounts, no data leaving the machine.

## Quick start
Pick whichever is easiest for you:
- **Simplest:** double-click `index.html` to open it in your browser.
- **Local server (no install):** `npm run local` → http://localhost:4173/
  (uses the bundled zero-dependency `serve.js`; override the port with
  `PORT`, e.g. `$env:PORT=8080; npm run local` in PowerShell).
- **VS Code:** install the "Live Server" extension, right-click
  `index.html` → "Open with Live Server".
- **Node (optional):** `npm start` (runs `npx serve .`).

## Project layout
```
business-evaluator/
├── index.html        # page shell
├── css/style.css      # all styling
├── js/data.js          # categories, questions, recommendations + SUBMIT_FORM (edit content here)
├── js/app.js           # rendering + scoring logic (edit behavior here)
├── api/                # Phase 1 submission service (Azure Functions → Cosmos DB)
│   ├── src/            # validate.js, handler.js, store.js, functions/submit.js
│   └── test/           # plain-Node unit tests (npm test in api/)
├── PHASE-1-PLAN.md      # corporate rollout roadmap + data-privacy note
├── AGENTS.md            # briefing file so opencode understands this project
├── opencode.json        # opencode project config (points at AGENTS.md)
├── setup.ps1 / setup.sh # one-time setup helpers (Windows / macOS-Linux)
├── serve.js            # zero-dependency local static server (npm run local)
└── package.json
```

## Using opencode to keep building this
This project ships with an `AGENTS.md` (opencode's project-briefing file) and
`opencode.json`, so opencode already knows the file layout, conventions, and
"do/do-not" rules before you ask it anything — see the **skills doc** at the
top of `AGENTS.md`.

1. Run the setup script once:
   - Windows (PowerShell, in VS Code terminal): `.\setup.ps1`
   - macOS/Linux/WSL: `bash setup.sh`
   This checks for Node.js/opencode, offers to install opencode, and inits a
   git repo (opencode works best inside a real repo).
2. From the project folder, start opencode:
   ```
   opencode
   ```
3. Ask it to extend the app in natural language, e.g.:
   - "Add an 8th category for Legal & Compliance with 5 questions and
     recommendations for weakness/opportunity/strength."
   - "Add a PDF export button next to the .txt export."
   - "Add a bar-chart legend explaining the color bands."
   - "Deploy this to GitHub Pages and write me the steps."
4. Because `AGENTS.md` already documents the scoring convention (`data.js`
   vs `app.js` separation, phrasing rule for questions, static-only
   constraint), opencode's suggestions should already match how this project
   is built — you shouldn't need to re-explain the architecture every time.

If you ever want opencode to re-scan and refine `AGENTS.md` itself (e.g.,
after you've made a lot of manual changes), just run `/init` inside the
opencode session — it updates the file in place rather than overwriting it.

## Customizing the assessment
All content lives in `js/data.js`:
- Add/remove/edit categories, questions, or recommendation text there.
- Adjust the score thresholds (`SCORE_BANDS`) that decide what counts as a
  Weakness (≤2.5), Opportunity (2.5–3.8), or Strength (>3.8) — tune these to
  taste.
- Change wording mode defaults / toggle labels are handled in `js/app.js`
  (`DEFAULT_MODE`).

## Submitting results
The "📤 Submit results" button sends the evaluation (in the currently selected
language) so leadership can collect/aggregate results. There are two targets,
configured in `js/data.js` → `SUBMIT_FORM`:

- `apiUrl` — (Phase 1) the secure submission endpoint,
  e.g. `https://<app>.azurestaticapps.net/api/submit`. When set, the app
  POSTs the structured evaluation (`{ language, categories: [...scores/bands] }`)
  and reports success. On failure it silently falls back to a form so no
  results are lost.
- `formUrl` / `prefillTemplate` — the Microsoft Form fallback:
  - `formUrl` — plain share link (e.g. `https://forms.office.com/r/AbCd123`).
    Results are copied to the clipboard and the form opens for pasting.
  - `prefillTemplate` — optional pre-filled form URL (⋯ → Get Pre-filled URL);
    when set, the form opens already filled with the results (no pasting).

With all three empty, the button still copies results to the clipboard but
shows a config hint instead of submitting.

## Corporate rollout (Phase 1)
See `PHASE-1-PLAN.md` for the step-by-step roadmap to a managed rollout
(Azure Static Web Apps + Entra ID + Azure Functions/Cosmos storage) and the
data-privacy note to bring to the approval gate. The `api/` submission
service is already scaffolded and unit-tested — run `npm install && npm test`
inside `api/` to verify.

## Roadmap ideas (good opencode prompts)
- A "benchmark" mode comparing scores against industry averages.
- Multi-language support for the questions and recommendations.
- A comparison view across more than two snapshots at once.

Already shipped: save/compare over time (localStorage snapshots +
JSON export/import), and print / save-as-PDF.
