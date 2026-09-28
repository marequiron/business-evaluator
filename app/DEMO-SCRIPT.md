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
| 0:30–1:30 | Profile → live evaluation | Click **Start Evaluation**; fill a few fields; type `$8,000` in startup cost; click **Continue to Evaluation**; in the wizard answer Q1 with "Not yet established (1)" and two more answers | "Ten validated profile questions — watch the startup cost format live." "Same 1–5 scale across ten areas." On the 1-rating: "Every rating gets a note, so answering 1 never feels like failing." On step 10 click **View results**. |
| 1:30–2:45 | Results dashboard | Scroll the results | "This is the honest math — unanswered questions count as zero, so the score can't be gamed by skipping." Point at the big score + band, the category bars, Top improvements, Risks with mitigations, Recommendations, and the 30/90-day plan with the one immediate action. |
| 2:45–4:15 | Presentation mode | Click **Presentation Mode**; arrow through the 11 slides | One line per slide: Vision → Problem → Solution → Target market → Business model → **pause ~3s on the big score** → Top strengths → Risks & mitigations → Short-term plan → Sustainability → Final recommendation. End: "Print or Save as PDF for the room." |
| 4:15–4:45 | Manage & backup | Exit to Evaluation Manager | Create/rename/duplicate; "auto-saved every keystroke"; then **Export JSON** and **Export CSV**. |
| 4:45–5:00 | Close | Back on the dashboard | "Idea tested in five minutes, risks surfaced, action plan in hand. Everything stays on your device." |

## Fallback path

If the wizard or typing stalls, do not fight it:

1. Go back to the welcome screen.
2. Click **Load Sample Idea** (FreshNest Meal Kits).
3. Jump straight to **View Results** / **Presentation Mode** from the dashboard.

## Tips

- Pause about 3 seconds on the "Evaluation score" slide — it is the emotional peak.
- Refresh is safe: evaluations are saved to localStorage on every keystroke.
- If the audience fires questions, the Risks & mitigations slide and the
  "one sentence to carry forward" slide carry the story alone.

## Post-demo verification

- `npm test` — all 53 tests pass.
- `npm run lint` (oxlint) and `npm run build` — clean.
- Production preview if needed: `npm run preview`.