# 5-Minute Great Idea Demo — Business Evaluator (competition script)

A ready-to-speak demo script for the Business Evaluator **React app** in `app/`.

> **Read first — two rules that make this script competition-safe.**
>
> 1. **Never mention AI.** The submitted app has no AI feature. Do not say
>    "AI-powered," "on-device AI," "AI-suggested scores," or "upload a document."
>    See `../competition/AI-ANALYZER-DECISION.md`.
> 2. **Skip the "What it costs" slide (slide 7 of 12) and never open the
>    quotation view.** The rate card in `src/lib/catalog.ts` is **placeholder
>    pricing**, and this entry does not present pricing. Arrow straight past it.
>
> If asked about either, the honest answers are: *"No AI in this version — the
> whole thing runs in the browser with no account, which is the point"* and
> *"Pricing is a later phase. It can price the work to close the gaps, but we're
> not presenting numbers we haven't validated with users yet."*

## Requirements

- Node.js installed.
- From `app/`: `npm install` (once), then `npm run dev`.
- Open the printed localhost URL in the browser.
- Pin/resize the window to about 1280x800 in an incognito window (clean start).
- Keep this script open beside the browser.

## Time-boxed run

| Clock | Stage | Action | Speaking notes |
| ----- | ----- | ------ | -------------- |
| 0:00–0:30 | Intro & Welcome | Land on the welcome screen | "Before anyone risks savings or starts pitching, this tool stress-tests the idea." Point at the hero: **"Everything runs in the browser — no account, no server, nothing leaves the device."** |
| 0:30–1:30 | Profile → live evaluation | Click **Start Evaluation**; fill a few fields; type `₱250,000` in startup cost; click **Continue to Evaluation**; in the wizard answer Q1 with "Not yet established (1)" and two more answers | "Ten validated profile questions — watch the startup cost format live." "Same 1–5 scale across ten weighted areas." On the 1-rating: **"Every rating gets a note, so answering 1 never feels like failing."** On step 10 click **View results**. |
| 1:30–2:45 | Results dashboard | Scroll the results | **"This is the honest math — unanswered questions count as zero, so the score can't be gamed by skipping."** Point at the big score + band, the category bars, **Top improvements** (say: "ranked by weight, so the highest-value fix comes first"), Risks with mitigations, and the 30/90-day plan with the one immediate action. |
| 2:45–4:00 | Presentation mode | Click **Presentation Mode**; arrow through the 12 slides — **skip "What it costs"** (slide 7) with a single arrow press, no pause | One line per slide: 1 Business name and vision → 2 Customer problem → 3 Proposed solution → 4 Target market → 5 Business model → 6 **pause ~3s on the big score** → 7 *(skip)* → 8 Top strengths → 9 Primary risks and mitigations → 10 Short-term plan → 11 Long-term sustainability plan → 12 Final recommendation. |
| 4:00–4:45 | Assessment depth | Back on the dashboard; open **Evaluation Manager** — create/rename/duplicate an evaluation, switch between them, then **Export JSON** and **Export CSV** | **"Auto-saved every keystroke, so a refresh never loses work."** "You can run this again in three months and compare — that's how you prove progress rather than assert it." On export: "Full results leave as a file the owner keeps. Nothing is uploaded." |
| 4:45–5:00 | Close | Back on the dashboard | **"Ten weighted areas, an honest score you can't inflate, and a plan you can act on this week. Everything stays on your device."** |

## Fallback path

If the wizard or typing stalls, do not fight it:

1. Go back to the welcome screen.
2. Click **Load Sample Idea** (FreshNest Meal Kits). This answer set is fully
   answered, so all ten category bars render populated and the presentation mode
   is immediately credible.
3. Jump straight to **View Results** / **Presentation Mode** from the dashboard.
4. Still skip the costs slide and still do not open **View quotation**.

> The sample is calibrated to score **65** — Growth tier with one locked
> service. Those tier and lock details are pinned by `sample.test.ts`. You do
> not need to mention either, and you should not quote the peso total.

## Strongest things to say, in order

If you only get a few sentences, use these. All are verifiable in the product.

1. **"The score can't be gamed."** Unanswered questions score zero and stay in
   the denominator. Skipping a category lowers your score; it never inflates it.
2. **"The weights are published, and they came from evidence."** Ten categories,
   weighted, summing to 100 — Customer Problem and Financial Viability 14% each,
   Market Opportunity 12%. Ask to see them; they are in the scoring file.
3. **"Nothing leaves the device."** No account, no server, no backend, no
   per-user cost. Two runtime dependencies total.
4. **"It gives the owner a plan, not a verdict."** The lowest band reads "early
   concept requiring validation," not "failed."
5. **"185 automated tests pass."** Say 185. Earlier drafts said 55 and 181; both
   were wrong.

## Anticipated judge questions

**"Is this AI?"** No — and that is deliberate. It runs entirely in the browser
with no account and no server, so the owner's financial data is never
transmitted. The international competitors all generate AI reports; we chose a
deterministic, inspectable instrument instead, and we publish the weights so
anyone can audit them.

**"Where does the money come from?"** Institutional licensing — cooperatives,
DTI Negosyo Centers, SBDC advisers, incubators. The owner pays nothing. See
`../competition/MSME-RESEARCH.md` §3a for the reasoning.

**"Have real businesses used it?"** Not yet — say so plainly. The next step is a
small pilot with a Negosyo Center or a BYUM contact, and the app is built to
print and export precisely so an adviser can run it inside a counseling session.

**"Why not a consultant, or the free DTI advice?"** Both remain. This doesn't
replace them — it gives an adviser a structured, scored, printable instrument to
run in a 30-minute session, at zero marginal cost.

**"How is it tested?"** 185 automated tests across 14 files, `npm test` from
`app/`, with the typecheck, lint, and build all clean.

## Tips

- **Pause about 3 seconds on the "Evaluation score" slide** — it is the
  emotional peak.
- Refresh is safe: evaluations auto-save to the browser on every keystroke.
- If questions take over, the Risks & mitigations slide and the final
  recommendation slide carry the story on their own.
- Do not open **Rate card** in the nav during a competition demo. It exists and
  is a good answer to "is this just a static PDF?", but it would put placeholder
  prices on screen.

## Post-demo verification

- `npm test` — all 185 tests pass across 14 files. If the run reports worker
  timeouts on a loaded machine, re-run single-threaded:
  `npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism`
- `npm run typecheck`, `npm run lint`, `npm run build` — clean.
- Production preview if needed: `npm run preview`.
