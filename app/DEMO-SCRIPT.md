# 5-Minute Great Idea Demo — Business Evaluator

A ready-to-speak demo script for the Business Evaluator React app. Follow the
time-boxed table strictly; if anything stalls, use the fallback path at the end.

## Requirements

- Node.js installed.
- From `app/`: `npm install` (once), then `npm run dev`.
- Open the printed localhost URL in the browser.
- Pin/resize the window to about 1280x800 in an incognito window (clean start).
- Keep this script open beside the browser.

## Time-boxed run

| Clock | Stage | Action | Speaking notes |
| ----- | ----- | ------ | -------------- |
| 0:00–0:30 | Intro & Welcome | Land on the welcome screen | "Before anyone risks savings or starts pitching, this tool stress-tests the idea." Point at the hero: "Everything runs in the browser — no account, no server, nothing leaves the device." |
| 0:30–1:30 | Profile → live evaluation | Click **Start Evaluation**; fill a few fields; type `₱250,000` in startup cost; click **Continue to Evaluation**; in the wizard answer Q1 with "Not yet established (1)" and two more answers | "Ten validated profile questions — watch the startup cost format live." "Same 1–5 scale across ten areas." On the 1-rating: "Every rating gets a note, so answering 1 never feels like failing." On step 10 click **View results**. |
| 1:30–2:45 | Results dashboard | Scroll the results | "This is the honest math — unanswered questions count as zero, so the score can't be gamed by skipping." Point at the big score + band, the category bars, Top improvements, Risks with mitigations, Recommendations, and the 30/90-day plan with the one immediate action. |
| 2:45–4:15 | Presentation mode | Click **Presentation Mode**; arrow through the 12 slides | One line per slide: Vision → Problem → Solution → Target market → Business model → **pause ~3s on the big score** → **What it costs** → Top strengths → Risks & mitigations → Short-term plan → Sustainability → Final recommendation. On the cost slide: "Services you can start now, and what unlocks the rest." End: "Print or Save as PDF for the room." |
| 4:15–4:45 | Quotation + backup | Exit to results, click **View quotation**; point at the struck-through list price and the two durations; freeze a proposal; then Evaluation Manager: create/rename/duplicate; "auto-saved every keystroke"; **Export JSON** and **Export CSV** | "Available now is priced, and the discount is shown as a real reduction rather than buried in the fine print." "Locked items still show the exact score that unlocks them — a roadmap, not a paywall." On the timeline: "Thirty-two weeks on your own, seventeen if you can run two at a time — and we say which one we're assuming." Freezing issues a numbered, dated proposal that won't drift. |
| 4:45–5:00 | Close | Back on the dashboard | "Idea tested in five minutes, risks surfaced, plan in hand, and a costed route to close the gaps. Everything stays on your device." |

## Fallback path

If the wizard or typing stalls, do not fight it:

1. Go back to the welcome screen.
2. Click **Load Sample Idea** (FreshNest Meal Kits). This answer set is
   calibrated to score 65 — Growth tier, 5% off, seven services open and
   Operations Blueprint locked — so the pricing treatment is visible without
   touching the rate card first.
3. Jump straight to **View Results** / **Presentation Mode** / **View quotation**
   from the dashboard.

## Tips

- If someone asks where the numbers come from, open **Rate card** in the nav and
  edit a price live — it is all in this browser, no account, and the quotation
  re-prices immediately. That is a strong answer to "is this just a static PDF".
- Pause about 3 seconds on the "Evaluation score" slide — it is the emotional peak.
- Refresh is safe: evaluations are saved to localStorage on every keystroke.
- If the audience fires questions, the Risks & mitigations slide and the
  "one sentence to carry forward" slide carry the story alone.

## Post-demo verification

- `npm test` — all 181 tests pass.
- `npm run lint` (oxlint), `npm run typecheck`, `npm run build` — clean.
- Production preview if needed: `npm run preview`.

## Note on the quotation and the rate card

Prices in `src/lib/catalog.ts` are **placeholders**. Replace them with your real
rate card before showing this to anyone outside the team. The entry gate,
per-product thresholds, tier discounts, and validity window are all in
`BUSINESS_PARAMETERS` in the same file.

You can also change the offer live from **Rate card** in the nav, without
touching code — useful for demoing with your real numbers. That is stored in
this browser only, so reset it afterwards if you do not want to leave your
figures on a shared machine.