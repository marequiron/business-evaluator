# Decision — drop the AI claim from the competition entry

**Decided:** 2026-10-01, by the participant.
**Outcome:** Option (b). Retitle; the AI analyzer becomes roadmap.

## The problem

An earlier draft of the submission was titled **"On-Device AI Business
Self-Evaluation Tool"** and selected the theme *Automation & Data Driven
Insights* and the category *New Technologies — Generative AI Solutions*,
explicitly **because the product uses generative AI**.

That is true of the **legacy** app at the repo root, which ships an on-device
document analyzer (`js/analyzer.js`, wllama, Qwen2.5-1.5B GGUF).

It is **not true of the React app** in `app/`, which is what this entry submits.
The React app has **no AI feature of any kind** — its only dependencies are
`react` and `react-dom`. There is no upload, no document parsing, no model.

A judge who opens the submitted app and finds no AI has been told, by the title
and the theme, that the central claim is false. That is a credibility failure
worse than any weaker claim, and it is the one error in this entry that could
disqualify it outright.

## The decision

Submit the React app on its actual merits. Do not claim AI.

**Title: DONE.** The title was "On-Device AI Business Self-Evaluation Tool" (42
characters). It is now **"On-Device Business Self-Evaluation Tool"** — 39
characters, still accurate, still well under the 50 limit. "On-device" survives
because it is true: the app runs entirely in the browser and sends nothing
anywhere. The AI wording is removed; all that remains is entering the corrected
string in the portal and confirming it took.

**Theme: KEEP *Automation & Data Driven Insights*.** Settled 2026-10-01. The
theme is defensible on its own merits — the product's entire output is a weighted
score computed from 40 inputs, with category benchmarks, ranked improvements and
trend comparison across saved assessments. Only the *justification* was tainted:
the old draft explained the theme as "selected because the idea involves a
generative AI capability." Replace that sentence with the data-driven one; keep
the theme.

**Initiative: CHANGE IT.** Settled 2026-10-01 → **`Tech and Digital Services`**.

*New Technologies — Generative AI Solutions* was selected per the guide's rule,
"if it involves AI, select this option" — and it does not. **Tech and Digital
Services** is not merely the safe substitute: it is an accurate description of
a browser-based digital service delivered to small businesses through advisory
institutions. The guide's own wording ties the AI option to AI involvement, so
this field genuinely had to move.

Theme and initiative are **two separate fields, and only one of them was
wrong.** Moving both would have cost a defensible theme for no benefit. The
remaining AI claim is in the **title**, and that is the one to fix.

**AI in the plan:** if AI is mentioned at all, it appears once, in the future
roadmap, phrased as intent — "planned," "next phase" — never as current
capability.

## What we gain and lose

**Gain.** The entry becomes true, which is the foundation everything else rests
on. The strongest surviving differentiators are real and verifiable: a published
weighting scheme judges can check against a research table, an offline
no-account no-data architecture, and 185 passing tests.

**Loss.** The nine international competitors in `MSME-RESEARCH.md` are all
AI-first. We stop competing on that axis.

**The honest counter-argument**, worth being ready to say out loud if asked:
those competitors generate prose reports with no primary data and no reproducible
scoring instrument, and all nine are priced in USD with no Philippine data. A
deterministic, auditable, peso-relevant, offline instrument is a different
product — not a lesser version of theirs. The weights are inspectable; their
model weights are not. That is a defensible position and it is true.

## Reversibility

This decision is not permanent. The analyzer is real, working code in the legacy
app, and porting it to the React app is a tractable piece of work —
`js/analyzer-parse.js` is already DOM-free and unit-tested, so the parsing half
is portable as-is. If the analyzer is later ported, the AI framing can be
restored, and the title lengthens back to 42 characters with room to spare.

Do not port it under deadline pressure with a competition submission pending.
Finish the entry first.
