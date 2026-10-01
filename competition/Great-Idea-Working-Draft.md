# Great Idea Competition 2026 — Business Plan Working Draft & Research Brief

**Business Evaluator** | Prepared for: Marion Requiron | Draft date: October 1, 2026

> ## ! Read before using this document
>
> **Per page 6 of the 2026 Philippines Great Idea Competition Handbook:**
> *"AI is a powerful tool and can be helpful in your work. However, it should
> only be used to assist you, and not to generate content. You may use AI to
> check your grammar, spelling, or clarity in writing. You may also use AI to
> research. AI cannot be used to write your business plan, create your video,
> or make slides or presentations for you. If most of the work is created by AI
> instead of by you and your team, your entry will be disqualified."*
>
> Everything below is therefore a **research brief and decision worksheet, not
> finished slide copy.** It contains (a) real, cited research you can
> legitimately use, and (b) options and open questions for each of the 6
> required sections.
>
> **You write the final sentences, choose the final numbers, and build the
> slides in your own words.** Do not copy-paste from here into the deck. Make
> sure you can speak to every number in it live.

## What changed in this revision, and why

Four things were wrong or weak in the 30 September draft. All are addressed here.

| Was | Now | Why |
| --- | --- | --- |
| Titled "**On-Device AI** Business Self-Evaluation Tool", themed *Automation & Data Driven Insights*, categorised *New Technologies — Generative AI*, with a fixed price model | **No AI claim anywhere.** Title is now *On-Device Business Self-Evaluation Tool*; category is now *Tech and Digital Services*; **theme is kept**; pricing is left **configurable** | **The submitted app has no AI.** Its only dependencies are React and React DOM. The document analyzer exists only in a different, older app. Claiming AI in the title while the demo shows no AI is the single highest-risk error in this entry. The theme survives on non-AI grounds — see §2. The category had to move, because the guide defines its AI option by AI involvement. The price moves because any peso figure would be a placeholder dressed up as a decision. |
| Described **8 categories**, *Strength/Opportunity/Weakness* bands, "55 automated checks" | **10 weighted categories**, 4 overall bands, **185 tests** | The draft described an older version of the product. See `PRODUCT-FACTS.md`. |
| 82% cash-flow failure figure used as Philippine evidence | Fenced as **US/international context**; Philippine evidence promoted | It traces to a U.S. Bank study. Citing it about Filipino businesses is a misattribution a judge may catch. |
| Market sized from a single news-reported figure | **Official PSA counts; Cebu Island named as the beachhead; the distribution channel is real and named** | The old figure (50,752) was DTI-*assisted* registrations, not the establishment register. The channel is not hypothetical — see §3. |

**Read alongside:** `PRODUCT-FACTS.md` (verified product claims),
`AI-ANALYZER-DECISION.md` (the reasoning above), `MSME-RESEARCH.md` (all
sources).

## Competition snapshot

- **Deliverables:** a slide deck (use the BYUM template) **and** a ~5-minute
  video. The template has 8 slides mapping to the sections below.
- **Category:** Tech & Digital Services. No exclusion-list conflict — not MLM,
  not a franchise, not licensing/network marketing.
  *Note: the B2B model in §2 is a license to use a tool, not a franchise or
  recruitment structure. If unsure, describe it as "institutional licensing" and
  do not use the word franchise.*
- **Language:** English only.
- **Do not analyze the world market or the national market** — the template
  requires the **local** market. See the warning in §3.

---

## 1. Problem / Customer Pain Point

### Research you can use

**The strongest evidence is about access to advice, not business failure.**
A CPA Australia survey of 4,236 SMEs across 11 Asia-Pacific markets found that
only **13% of Filipino SMEs sought advice from an IT consultant** in the past
year, against a **28% Asia-Pacific average** — the widest gap of any market
surveyed. Meanwhile **65%** of surveyed Filipino SMEs sought external financing
in 2024, but only **22% found it easy to obtain.**

*Source: CPA Australia, 16th Annual Asia-Pacific Small Business Survey, May 2025.*

This is a good problem statement because it is not a failure statistic. It says
something more useful and more defensible: **Filipino business owners want
structured advice, and the channels for getting it are not reaching them.**

**Second: technology adoption pays, when owners can afford it.** Of the Filipino
SMEs that *did* invest in technology in 2024, **69% reported improved
profitability**, above the 56% regional average. *(Same source.)* So there is
demand, and there is a return — the barrier is access, not appetite.

**Third: cash fragility is real and measured locally.** An ADB survey of 3,877
MSMEs across developing Asia, 1,804 of them Philippine, found that **42.1% said
their cash would run out within a month** and **58.8% reported zero income**
during COVID-19. DTI reported 90,000 businesses still closed in 2020. Yet only
**30% of micro and small enterprises had any business continuity plan** (UNIDO
2022, citing PSA).

> **Careful with these.** They are COVID-period figures. Do **not** present them
> as a normal-year failure rate. Use them to show fragility, not annual mortality.

**The gap this points at:** owners get no structured read on their own business
until something breaks, and the advisory channels that could give them one are
free, over-subscribed, and — on this evidence — not reaching them.

### What you need to supply

- **Your own observation.** What have you personally seen or heard from Cebu-area
  business owners about how they assess their own business, if at all? A
  specific anecdote from someone you know is worth more than any statistic here.
  Judges can tell the difference instantly.
- **Choose your lead pain point.** (a) Not knowing where the business is weak
  until it is a crisis; (b) not wanting to hand financials to a consultant or an
  online tool; (c) no time for a structured review. Pick one or two and commit.

> **YOUR DECISION — pick the 1–2 pain points you lead with, and write this
> section in your own words.**

---

## 2. Business Venture, Product or Services

### What it actually is — verified

A **browser-only business self-assessment tool.** No install, no account, no
backend, no server. A business owner answers **40 questions (1–5 scale) across
10 weighted categories**; the app computes a weighted **0–100 score**, places it
in one of **four bands**, and produces a tailored action plan: strengths, ranked
improvements, a risk register with mitigations, and a 30/90-day roadmap. Answers
auto-save on every keystroke. There is a **12-slide presentation mode** that
prints to PDF, plus JSON/CSV export and saved-history comparison.

The ten categories and their weights (sum to 100%):

| Weight | Category | Weight | Category |
| ------ | -------- | ------ | -------- |
| 14% | Customer Problem | 10% | Risk and Business Resilience |
| 14% | Financial Viability | 8% | Competitive Advantage |
| 12% | Market Opportunity | 8% | Scalability and Long-Term Growth |
| 12% | Value Proposition | 6% | Sustainability |
| 10% | Operational Feasibility | 6% | Founder Readiness |

**Two design decisions worth explaining to judges, because they are what make
it credible:**

1. **The score cannot be gamed.** An unanswered question scores **zero** and
   stays in the denominator. Skipping a category lowers your score; it can never
   inflate it. Most self-assessment tools quietly treat blanks as neutral.
2. **It never renders a verdict.** The lowest band reads *"Early concept
   requiring validation,"* not *"failed."* The top band still asks for continued
   validation. It is a planning instrument, not a judgment.

**Engineering, if a judge asks:** React 19 + TypeScript, **185 automated tests
across 14 files**, typecheck and lint clean, **two runtime dependencies total**
(React and React DOM). No UI kit, no chart library, no analytics, no telemetry.
Ships as a static site and as a Windows desktop app.

> **Do not claim:** any AI feature, any upload or document reading, any peso
> price, any user numbers, and never "8 categories" or "55 tests." Full list in
> `PRODUCT-FACTS.md` §7.

### The model — decided

**B2B / white-label: license the tool to institutions, not to individual
owners.** Cooperatives, DTI Negosyo Centers, SBDC advisers, microfinance
institutions, business incubators. Full reasoning in `MSME-RESEARCH.md` §3a. The
short version:

- The owner is the wrong payer. 65% of Filipino SMEs sought external financing
  and only 22% found it easy. Asking a micro enterprise to subscribe monthly is
  asking it to spend money it has already said it struggles to get.
- Free human advice (DTI/SBDC, CPAs) is the real competitor and we cannot beat
  it on price. We can make *their* counseling better — a structured, scored,
  printable instrument they run inside a session they are already giving.
- It dissolves the offline-payment problem: the institution pays; the owner pays
  nothing, which is also the strongest possible answer to adoption risk.
- It matches the competition's stated self-reliance mission.

**Do not present this as a trading business.** There is no license, no pilot,
and no institutional agreement. It is the model the entry argues for.

> **DECIDED — pricing is deliberately left configurable, not fixed to a number.**
> No peso figure is committed in this draft or the deck, and none should be
> invented later just to fill the Financials slide. The principle to state
> instead: **the price is set per institution, in consideration of that
> institution's users and their ability to pay.** A cooperative serving
> micro-entrepreneurs, a city government, and a university incubator are not
> the same buyer, and a single list price would be wrong for at least two of
> them.
>
> This is not a dodge, and it is not an empty §5 — **the product already does
> this.** The app's rate card is not hardcoded: `loadRateCard()` merges a
> deployer's saved overrides onto the shipped catalogue by product and tier
> (`app/src/lib/ratecard.ts`). Every licensee can set their own prices, and a
> frozen proposal records exactly what was quoted so it cannot drift. So
> "configurable pricing" is a shipped feature, and you can demonstrate it.
>
> **Two things this frees you from, and one it still costs you.** It frees you
> from inventing a peso figure you cannot defend, and it removes the costs
> slide from the demo (`app/DEMO-SCRIPT.md` — placeholder prices must not be
> shown). It still costs you a **financial projection for §5**: "configurable"
> is a pricing *policy*, and judges will want to see that you can add up what
> it would produce. Model it as a small number of named licensees at a price
> *you choose as an illustration*, clearly labelled as one worked example, not
> as your committed pricing.
>
> **One caution that constrains any price you illustrate.** DTI's 40 Negosyo
> Centers in Cebu already provide business advisory **free of charge**, and free
> advisory is their mandate. Charging a government body whose core service is
> free is not a credible plan, so the public-sector case is a **free or
> near-free pilot funded by prize money** (§6) — which is exactly what the
> configurability argument is for. Commercial licensing sits with the private
> institutions: cooperatives, microfinance providers, and incubators. Work out
> which parts of your §5 numbers rest on DTI and which on private licensees,
> because only the second can carry revenue.

---

## 3. Market Size and Growth

> ### The local-market requirement
> The BYUM template says, verbatim: *"Analyze your target market... This should
> be done within your specific market. **Do not analyze the world market or even
> the country market, rather analyze your local market.**"*
>
> **This is the one section where judges have explicit license to deduct.** Lead
> with Central Visayas. National figures are supporting context, clearly framed
> as context, not as the analysis.

### Local — Central Visayas, and Cebu Island specifically (lead with this)

**Official counts.** From the PSA List of Establishments 2023, published as DTI's
*2023 Philippine MSME Statistics in Brief*:

| Central Visayas (Region VII) | Establishments |
| --------------------------- | -------------- |
| Micro | 78,443 |
| Small | 9,106 |
| Medium | 437 |
| **Total MSMEs** | **87,986** — 99.46% of the region |
| Large | 482 — 0.54% |
| **Total** | **88,468** |

MSME employment in the region: **497,774**, 59.96% of 830,195 total.
**Growth: 80,172 establishments (2022) → 88,468 (2023), up 10.4% in one year.**

> **Careful with the two regional figures.** DTI Region 7 also cites **50,752
> MSMEs registered in 2024**, up from 41,164 in 2023, out of 77,020 enterprises
> assisted. That is **DTI-assisted registrations — a smaller, different
> universe** from the PSA establishment register. Use the **87,986** figure as
> the market size, and the DTI figure only if you label it as assisted
> registrations. Do not present one as the other.

**Cebu Island is the beachhead.** Region VII covers Cebu, Bohol, Negros Oriental
and Siquijor. Cebu Island — the province plus Cebu City — holds the
overwhelming majority of the region's businesses and **all 40 of its Negosyo
Centers**. Name Bohol and Negros Oriental as expansion, not as part of the
opening market.

> **The number you do not have.** A precise Cebu-Island-only MSME count is not
> in the public regional tables. It exists in PSA's provincial List of
> Establishments releases, obtainable from PSA Regional Statistical Services
> Office 7 in Cebu City. **Do not estimate it.** Either get the real figure or
> present 87,986 for the region and state plainly that you would start on Cebu
> Island. An invented local number is the kind of thing a judge checks.

**The angle worth making.** A region adding 10.4% of its entire establishment
base in a single year means businesses are forming faster than advisory capacity
scales to serve them. That is the access problem from §1, visible in one region,
checkable in one sentence.

### The distribution channel already exists — 40 Negosyo Centers

**This is the strongest local fact in the entry, and it is not a statistic.**

- DTI operates **40 Negosyo Centers in Cebu.** The 40th opened in **Cebu City on
  May 15, 2026** as a DTI / Cebu City Government partnership, bringing
  registration, mentoring and financing information directly to entrepreneurs.
  DTI Cebu Provincial Director: **Marivic Aguilar**.
- The 36th (Cebu Province) was Compostela, Aug 2024; the 37th was **Carmen,
  Cebu**, Nov 2024 — a town of nearly 2,000 registered businesses.
- Nationally, Negosyo Centers cover **1,311 of 1,634 LGUs (80.3%)**, and
  government has committed to opening the remaining 323.
- The provincial government runs its own **Sugbo Negosyo Center** program.

*Sources: DTI / SunStar Cebu; DTI Negosyo Center program pages.*

**Why this carries the section.** The B2B model in §2 needs counterparties, and
they are not hypothetical: **40 government-operated advisory Centers are already
running in Cebu, doing exactly the counseling work this tool equips, and the
newest is precisely the kind of institutional partnership a license would
formalise.** A judge cannot call "we would approach DTI" naive when there is a
funded, expanding, government-run network with a named director.

**Two things not to overclaim.** DTI is not a customer and has agreed to nothing
— say *the channel exists and is the obvious first conversation*, not *DTI is
partnered*. And note in §4 that their advisory is already free.

### National — context only, clearly framed as context

- **1,246,373 registered establishments; 1,241,733 are MSMEs (99.63%).** Micro
  1,127,058, small 109,912, medium 4,763. *(PSA 2023 List of Establishments.)*
- MSMEs support **66.97% of national employment** — 6,351,466 of 9,483,965.
- MSMEs generate a large share of employment but a much smaller share of export
  revenue, so Central Visayas MSMEs are domestic-facing local businesses. They
  do not need enterprise BI; they need something fast and simple.

### Competitive landscape

Nine international competitors, all AI-first, all USD-priced from $9–$199 per
month, none citing a single Philippine statistic — see `MSME-RESEARCH.md` §3 for
the full table with live links.

**But you are not competing on AI.** The submitted app has no AI, and the entry
does not claim any. The defensible comparison is narrower and true:

| Dimension | The nine competitors | This tool |
| --------- | --------------------- | --------- |
| Method | AI-generated prose | Deterministic weighted scoring |
| Weights | Not published | **Published and auditable** |
| Data | No local data | Philippine, cited |
| Price | USD, $9–$199/mo | Free to the owner |
| Connectivity | Cloud-dependent | **Fully offline** |
| For | Pre-launch idea validators | Existing businesses too |

**One competitor to be honest about:** PHLAZE claims local-first, no-account
storage and is the closest thing to a direct competitor. Do not claim we are the
only ones doing offline. Our answer is the weighting and the evidence base, not
the privacy property.

**And the real competitor is not an app.** It is free human advice — DTI/SBDC
counseling (MSME Caravan has trained 46,000+ owners) and CPAs offering free
30-minute consultations. Answer this head-on in §6.

> **YOUR DECISION — have you actually searched for a Philippine competitor?**
> Search Filipino-language material, DTI-accredited consultants, and local
> startup directories. If you have not found one, you may state that — but only
> having looked. If you find one, compare directly; conceding a real competitor
> and explaining the difference is stronger than an unqualified gap claim.

---

## 4. Marketing and Sales Strategy

### Channels, ranked by fit with the B2B model

| Channel | What it means | Fit |
| ------- | ------------- | ---- |
| **DTI Negosyo Centers (40 in Cebu)** | The instrument becomes a companion resource to counseling already being given free to Cebu MSMEs | **Best, and it already exists.** But advisory is free — so this is a pilot channel, not a revenue channel (§2) |
| **Cebu City Government** | The 40th Center is a DTI–City partnership; the same relationship could carry a licensed instrument | Strong, same caveat |
| **Cooperative / microfinance** | Already aggregate members and run business training | **Best revenue channel** — private, and already selling to the segment |
| **SBDC / business incubators** | Structured advisory capacity is what they lack | Strong revenue channel |
| **Sugbo Negosyo Center (provincial)** | Provincial MSME support program, same channel | Strong |
| BYU / BYUM network | Direct access to aspiring entrepreneurs; the venue for the pitch | Strong for the pilot, weak for scale |
| Organic / social | Facebook groups, local business pages | Lowest cost, slowest |

**The strategy in one line:** do not market to owners — owners are the users, not
the buyers. Win the institutions, and reach thousands of owners through them at
zero distribution cost.

**First-50-users answer.** Judges will ask. The honest one: *"We don't need 50
individual users. We need two or three institutions who run it inside a session
they are already giving, and the owners come with them."* That reframing is
stronger than a funnel projection because it is true and checkable.

**The competitive bar you have to clear.** DTI's MSME Digitalization Caravan has
already brought **GCash, Globe, Maya and PLDT** into Cebu to advise MSMEs, free,
at scale. So the tool is not competing against "no digital support" — it is
competing against free, high-quality, brand-backed digital advisory. The
differentiation has to be the **scored, weighted, published output that those
services do not produce**, not the price and not the format.

> **YOUR DECISION — name the 1–2 institutions you will approach first, by name.**
> DTI Cebu's provincial office and the Cebu City Government partnership are
> concrete and current. For revenue, name a specific cooperative or
> microfinance institution. Specificity beats breadth, and a named Negosyo
> Center is the most persuasive sentence available to you.

---

## 5. Financials

> **No figures have been invented here, deliberately.** Fabricating projections
> would mean the AI effectively wrote your business plan, and would be
> disqualifying — and it would not be true. Below is the structure and the real
> cost categories. **You supply the numbers.**

### Costs to quantify (you are the only source for these)

- **Hosting** — the app is a static site; near-zero. Name your actual host.
- **Development time** — your hours, valued at a market rate. Judges may probe
  this; valuing your own time honestly reads as more credible than ignoring it.
- **Institution licensing infrastructure** — what it takes to deliver and support
  a license. Note you currently have **no backend and no payment processing**;
  be honest that this is a cost you have not yet incurred.
- **Support and updates** — the ongoing cost of maintaining a tool that
  institutions depend on.

### Revenue model: institutional licensing

Per §2, the payer is an institution. **Pricing is configurable per licensee and
committed to no fixed number** (§2) — which the product supports natively, since
each deployer sets their own rate card. Build the model around:

- Number of institutions you can realistically reach in year 1
- **The price each institution can bear**, set in consideration of the businesses
  *its* users are — this is the whole point of not fixing a single number
- What each institution brings you in member businesses
- The **₱150–250/hour** local consulting anchor as the reference a licensee
  compares a licence against, not as a price you must undercut

**Be conservative and be ready to justify live.** A small, defensible number
beats an ambitious one that collapses under questioning.

### Risk factors — pick the ones you can speak to

- **Adoption risk.** Will owners trust a tool with their business data? Mitigation
  is architectural: it runs in the browser and transmits nothing, so there is
  nothing to trust with. This is your strongest risk answer because it is
  structural, not a promise.
- **Distribution risk.** Institutions are sales cycles, and you are one person
  with a day job. Be honest about the pace.
- **The "no local competitor" claim is unverified.** If one exists, the market
  thesis needs adjusting. This is the risk most likely to be exposed by a judge
  who has read the local market.
- **Monetization risk.** No license, no pilot, no institutional agreement yet.
  Say so before they ask.
- **Connectivity.** Only 6% of MSMEs use advanced digital tools and 23% use none
  at all. For the B2B model this is *less* of a risk, because the user is a
  trained adviser on institutional equipment — say that, it is a good answer.

> **YOUR DECISION — fill in your own projections.** Institutions, illustrative
> price, users reached through them. Keep it conservative and know your
> arithmetic cold. Pricing being configurable does **not** exempt you from this
> slide: show one clearly-labelled worked example, or judges will read
> "configurable" as "unconsidered."

---

## 6. Use of Prize Money

The handbook asks you to detail spending *"as if you had the business,"* even if
the funds would otherwise go to education. Frame it as genuine investment.

| Line | What | Why it is defensible |
| ---- | ---- | -------------------- |
| **Formal registration & compliance** | DTI business name registration, BMBE registration if eligible, permits | Undeniable baseline for any real venture |
| **Pilot with a partner institution** | Running the tool with a Negosyo Center or cooperative — materials, travel, staff time | Converts a claim into evidence. **This is the highest-value line on the list**, because it closes the "no user has tested this" gap |
| **Professional security & legal review** | A paid review before institutions put real client businesses through it | The app holds no secrets today, but institutional use raises the bar, and showing you took it seriously matters |
| **Backend for licensing** | The auth and payment infrastructure you do not have | Only needed once a license is actually sold — sequence it after the pilot |
| **Equipment** | For pilot users who need a device to run it | Practical, small, defensible |
| **Education / upskilling** | Explicitly permitted by the handbook | Fine as a small line, not as the headline |

**Rank the pilot above the backend.** A judge asking "how do you know anyone
wants this?" is answered by a pilot, not by infrastructure. Money spent before
there is demand is the most common way these plans read as ungrounded.

> **YOUR DECISION — assign a specific peso amount and percentage to each line.**
> Judges reward specificity ("₱15,000 for X") over vague categories. Every peso
> must be one you can defend by name.

---

## 7. Explain why you believe in this business

The template's final prompt asks you to *explain why you believe in this is a
potentially successful venture.* This is the most personal section and there is no
research to lean on. Points worth considering as **your own** material:

- You built it. It is tested, works offline, and runs at zero marginal cost.
- The problem evidence is strong and local, and it is about *access to advice* —
  a gap that is still open, not a fad.
- The instrument is auditable, which almost nothing in this market is.
- The most likely outcome is not a venture empire. It is a tool that measurably
  helps a few thousand Cebu business owners avoid a mistake they would not have
  seen coming. That is a legitimate and modest ambition — and **modest
  ambition, honestly stated, reads as more credible than a hockey stick.**

---

## Next steps

1. **Confirm the submission format and date from your invitation email.** The
   handbook PDF is a **scanned image with no text layer**, so its timeline could
   not be machine-read. Do this before scheduling your own work.
2. **Read `PRODUCT-FACTS.md`** and `AI-ANALYZER-DECISION.md` before writing
   anything about the product.
3. **Make the 4 remaining decisions** flagged above: competitive comparison
   after your own search, first named institutions, financial projections, and
   prize-money allocation. **Pricing is settled** — configurable per licensee,
   no committed peso figure (§2).
4. **Rewrite every section in your own words.** This is a research brief, not
   submission text.
5. **Build the slides yourself** in the BYUM template (8 slides). Use the demo
   script in `app/DEMO-SCRIPT.md` to rehearse the live demo, and **skip the
   costs slide** — see the warnings at the top of that file.
6. **Narrate the video yourself.** The handbook bars AI from creating the video,
   and it is excluded from this draft. Rehearse against the demo script.
7. **Get a teammate or mentor to review the deck** for authenticity before
   submitting. Given the handbook's explicit AI clause, that check is worth more
   than usual.
8. **Re-check volatile figures.** The Negosyo Center count (40 as of May 2026)
   and competitor prices both move. Re-verify immediately before presenting.

### Claim checklist before you submit

- [ ] No AI claim anywhere — title, theme, category, script, video. Theme is
      *Automation & Data Driven Insights*, category is *Tech and Digital
      Services* — confirm both are set as written
- [ ] 10 categories, 4 bands, 185 tests — never 8, never 55
- [ ] No peso prices or quotation figures in the pitch; any figure in the
      Financials slide is one **clearly-labelled worked example**, not committed
      pricing
- [ ] Pricing stated as configurable per licensee, in consideration of each
      institution's users — with the rate-card edit as the proof it is real
- [ ] No implied users, pilots, or revenue
- [ ] 82% cash-flow stat, if used at all, labelled as **international**
- [ ] Market section leads with **Central Visayas, Cebu Island**
- [ ] **87,986** used as the Central Visayas MSME count; 50,752 labelled as
      DTI-assisted registrations, never conflated
- [ ] No invented Cebu-Island-specific number
- [ ] Negosyo Center count described as a **channel**, not a partnership
- [ ] Every peso figure traceable to a decision you made
- [ ] You can speak to every number in the deck without notes
