# Business Evaluator — Idea Submission Draft

**We Innovate Portal** | Prepared for: Marion Requiron | Revised: October 1, 2026

Field values follow the We Innovate Idea Submission work instruction: Idea Title
(≤50 characters), Theme, Initiative, Current Situation, Suggestion, Benefits.
Paste into `weinnovateportal.accenture.com` → Ideas → Submit Idea.

> ## ! Read first — the AI fields are wrong and must be changed
>
> The previous version of this draft was titled **"On-Device AI Business
> Self-Evaluation Tool"** and selected the theme ***Automation & Data Driven
> Insights*** and initiative ***New Technologies — Generative AI Solutions***,
> each chosen **because the product uses generative AI.**
>
> **It does not.** The application being submitted has **no AI feature of any
> kind** — its only dependencies are React and React DOM. There is no upload, no
> document parsing, no model. An older version of the tool did have an on-device
> document analyzer; that is a different application and is not what is being
> submitted here.
>
> If a reviewer opens the app and finds no AI, the title, theme, and initiative
> have all been shown to be false. **This is the highest-risk item in the
> submission.**
>
> **All three portal fields are settled. Nothing left to decide — only to enter.**
>
> - **Title** — *On-Device Business Self-Evaluation Tool*. The "On-Device AI"
>   wording is **removed**; the remaining title is accurate and 39/50 characters.
>   Before you submit, confirm the portal actually shows this string.
> - **Theme** — *Automation & Data Driven Insights*. Kept. The tool genuinely
>   produces data-driven insight; only the old *justification* (which cited AI)
>   had to go. See below.
> - **Initiative** — *Tech and Digital Services*. Decided 2026-10-01, replacing
>   *New Technologies — Generative AI Solutions*, which the guide defines by AI
>   involvement. This is an accurate description of the product, not just a
>   safe substitute.
>
> If a reviewer opens the app and finds no AI, the title alone would have been
> enough to show the submission was false. It has been the highest-risk item
> throughout, and it is now closed.
>
> If AI is mentioned at all, it appears once as planned roadmap work, never as a
> current capability.
>
> Reasoning and the option to reverse this later:
> `business-evaluator/competition/AI-ANALYZER-DECISION.md`.

---

## Part 1 — We Innovate Portal Submission

### Idea Title — 39 / 50 characters

```
On-Device Business Self-Evaluation Tool
```

"AI" removed. The title remains accurate and still under the limit; **"on-device"
survives because it is true** — the app runs entirely in the browser and
transmits nothing anywhere.

**Enter this exact string in the portal.** Confirm the submitted title reads
"On-Device Business Self-Evaluation Tool" before you submit — this was the one
false claim in the entry, and it is easiest to fix wrongly.

### Theme

```
Automation & Data Driven Insights
```

**This theme is correct and does not need to change.** The product genuinely
produces data-driven insight: a weighted score computed from 40 inputs, category
benchmarks, ranked improvements, and trend comparison across saved assessments.

**The justification must change, though.** The previous draft justified this
theme *"because the idea involves a generative AI capability."* That rationale is
unusable — there is no generative AI. Replace it with something like:

> *"Selected because the idea's core value is turning a business's own
> self-reported data into a scored, weighted, comparative insight — a published
> weighting scheme, category benchmarks, and ranked improvements that can be
> tracked over time."*

That statement is true, is a better argument than the AI one, and holds up if
anyone opens the app.

### Initiative

```
Tech and Digital Services
```

**Decided 2026-10-01.** This replaces *New Technologies — Generative AI
Solutions*, which the guide defines by AI involvement ("if it involves AI,
select this option"). The idea does not involve AI, so that field was wrong.

**This is a good fit, not merely a safe one.** The entry is a digital service
delivered to small businesses: a browser-based self-assessment tool, with
advisory institutions as the channel. That is squarely tech and digital
services, and it is also the honest description of what judges will see when
they open the app.

**What to say about the category if it is ever explained:** the initiative
digitises a business-advisory process — structured, scored, repeatable
assessment that previously depended entirely on a counselor's time — and it
does so without collecting a single byte of the business's data off its device.

### Current Situation

Business owners, incubating teams, and coaching or mentoring programs lack a
fast, structured, and privacy-safe way to assess business health across the
functional areas that most often determine small-business survival — customer
problem, financial viability, market opportunity, value proposition, operations,
risk, competitive advantage, scalability, sustainability, and founder readiness.

Existing self-assessment approaches are typically manual: static spreadsheets,
generic PDF checklists, or consultant-led workshops. They share three consistent
gaps. First, no automated scoring or standardized benchmarking across categories,
so two different assessors reach different conclusions on the same business.
Second, no tailored recommendation tied to the specific score a business
actually earns, so the output is generic advice the owner already knows. Third,
no way to get a structured read on a business without handing sensitive
financial or customer data to a third party — which is precisely why owners skip
structured self-evaluation entirely, and why the problem surfaces later and at
higher cost.

The gap is measurable. An ADB survey of 1,804 Philippine MSMEs found 42% said
their cash would run out within a month, while only 30% of micro and small
enterprises had any business continuity plan. A CPA Australia survey of 4,236
Asia-Pacific SMEs found only 13% of Filipino SMEs sought advice from an IT
consultant in the past year, against a 28% regional average — Filipino owners
want structured business advice and are the least likely in the region to receive
it.

### Suggestion

Introduce the Business Self-Evaluation Tool: a lightweight, browser-based
application requiring no installation, no account, and no backend server. A user
answers 40 Likert-scale (1–5) questions across **10 weighted categories**, and
the application computes a weighted 0–100 score, classifies it into one of four
performance bands, and produces a tailored action plan — ranked improvements, a
risk register with paired mitigations, and a 30-day and 90-day roadmap.

Three design decisions distinguish it from the category. The scoring weights are
**published and sum to 100** — Customer Problem and Financial Viability at 14%
each, Market Opportunity at 12% — and are drawn from documented research into
what most often precedes MSME failure, so the instrument is auditable rather
than opaque. **Unanswered questions score zero and remain in the denominator, so
the score cannot be inflated by skipping categories**, which is a common and
undisclosed weakness of self-assessment tools. And the tone is deliberately
non-judgmental: the lowest band reads "early concept requiring validation" rather
than "failed," because the tool is a planning instrument, not a verdict.

Because all scoring happens client-side, **no business data ever leaves the
user's device.** The application also provides a 12-slide presentation mode that
prints to PDF for pitching to a lender or partner, JSON and CSV export so the
owner retains a portable record, and saved-history comparison so progress is
demonstrable across assessments rather than asserted. The assessment content is
data-driven, so the same engine can be repointed at other assessment domains
without rewriting application logic.

### Benefits

- **Time savings:** compresses a structured business health review — normally hours
  of spreadsheet work or a scheduled consultant session — into roughly 10–15
  minutes of guided input, with results immediately available.
- **Consistency and quality:** replaces ad-hoc judgment with a repeatable,
  weighted, ten-category framework and recommendations tied to the score actually
  earned, reducing variation between assessors and between sessions.
- **Privacy and compliance by design:** all scoring runs client-side, so no
  financial or customer data is transmitted, stored on a server, or seen by a
  third party. This directly supports responsible data-handling principles and
  removes the main reason owners decline structured assessment.
- **Honest measurement:** unanswered questions cannot be used to inflate a
  score, making results comparable across businesses and over time.
- **Progress tracking:** saved history and side-by-side comparison support
  periodic review in coaching and incubation programs, where repeat measurement
  matters more than a single point-in-time score.
- **Zero infrastructure cost to deploy:** a static, no-backend application can be
  deployed immediately with no hosting fees, no licensing, and no per-user cost,
  making it practical for organizations with limited budgets.
- **Extensible:** category and question content lives in one data-driven
  configuration, so the engine can be applied to other assessment domains —
  team maturity, client readiness, security posture — without changes to
  application logic.

### Collaborators

Optional — up to 3 Enterprise IDs for anyone who contributed outside their normal
responsibilities. Leave blank if none.

### Privacy statement reminder

Before submitting, the portal asks you to confirm the idea contains no personal
information, confidential client information, or restricted business information.
The text above is product-level and contains no client or personal data. Review
it once more against any pilot data before you click Submit. Per Step 8 of the
work instruction, do not attach supporting files at initial submission — reviewers
will request them if needed.

---

## Part 2 — Pitch talking points

### 30-second hook

> "Most small businesses never get a structured health check, because it takes
> hours and usually means handing your financials to someone else. This gives an
> owner that check in ten minutes — and the answer never leaves their device,
> because the scoring runs entirely in their browser."

### Problem → Solution → Impact

- **Problem:** structured self-assessment is slow, inconsistent, and usually
  requires handing sensitive data to a third party. 13% of Filipino SMEs sought
  IT advice last year versus a 28% regional average.
- **Solution:** a free, no-install, ten-category weighted assessment with instant
  scoring, a published and auditable weighting scheme, and a tailored action
  plan — entirely in-browser.
- **Impact:** minutes instead of hours, zero data exposure, a defensible and
  repeatable score, and zero infrastructure cost to deploy.

### The three strongest claims, in order

1. **"The score can't be gamed."** Unanswered questions score zero and stay in
   the denominator. Skipping a category lowers your score; it never inflates it.
2. **"The weights are published, and they came from evidence."** Ten categories,
   weighted to 100, derived from documented research into what precedes MSME
   failure. Ask to see them.
3. **"Nothing leaves the device."** No account, no server, no backend, no
   per-user cost, two runtime dependencies total.

### Anticipated questions

**"Is this AI?"**
No, and that is deliberate. The app runs entirely in the browser with no account
and no server, so the owner's financial data is never transmitted. The
international competitors in this space all generate AI reports; we chose a
deterministic, inspectable instrument instead, and we publish the weights so
anyone can audit them.

**"How is it secured?"**
There is very little to secure. All processing is client-side, no credentials or
tokens are stored, and no data is transmitted. For a future licensed deployment
we would add authentication, a signed submission endpoint, and a formal security
review before any institution put real client businesses through it.

**"Is it tested / production-ready?"**
Yes — 185 automated tests across 14 test files, runnable with a single `npm test`,
with typecheck, lint, and build all clean.

**"What does it cost to run?"**
Nothing beyond static file hosting. No server, no database, no per-user costs,
because nothing runs on our side.

**"How would this scale beyond a pilot?"**
The assessment content is fully data-driven, so the engine can be repointed at
other assessment domains. The intended model is institutional licensing to
cooperatives, DTI Negosyo Centers, and incubators — so reach scales through
partner institutions rather than through our own sales force.

**"Has anyone actually used it?"**
Not yet. The next step is a pilot with a partner institution, and the app is
built to print and export precisely so an adviser can run it inside a counseling
session they are already giving.

### Live demo

Use `app/DEMO-SCRIPT.md`, which is a complete time-boxed 5-minute script. Two
hard rules from it: **never mention AI**, and **skip the "What it costs" slide
(7 of 12)** — the shipped prices are placeholders and this entry does not
present pricing.
