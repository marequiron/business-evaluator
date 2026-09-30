# MSME Research Notes — Great Idea Competition

**Purpose:** evidence gathering for the Great Idea Competition submission.
**Scope:** Philippine local market only. Research notes with sources, gathered
2026-09-30.

> **Authoring boundary.** Per the competition handbook, AI must not write the
> business plan, video, or slides. This file is *research*, which the handbook
> permits. Anything that becomes submission content must be written by the
> participant.

---

## 1. Local market size — Philippine MSMEs

**1,241,476 registered business establishments; 99.63% are MSMEs (1,236,908).**
Only 0.37% (4,568) are large enterprises.

Breakdown:
- Micro: 90.66% (1,125,476)
- Small: 8.60% (106,799)
- Medium: 0.37% (4,633)

*Source: DTI, 2024 Philippine MSME Statistics —
https://www.dti.gov.ph/dti-knowledge-hub/dti-statistics (data: PSA List of
Establishments). A 2023 PSA briefing gives a near-identical 1,241,733 total.*

**Economic weight.** MSMEs comprise ~99.5% of Philippine enterprises, contribute
~35.7% of total value added (2020), ~60% of exports, and support ~62.7% of total
employment. (PSA 2020, cited in UNIDO 2022 *Outlook and Trends for Philippine
MSMEs*.)

**How to use this.** It establishes that the target population is over 1.2
million establishments and that even a very small share is a viable business.
It also frames the tool as *mainstream*, not niche — nearly every Philippine
establishment is an MSME.

---

## 2. Why they fail — the problem evidence

This is the core of judging criterion 1 (*clear problem statement with
supporting data*).

**Cash flow is the leading cause of failure.** Multiple sources converge on
82% of small businesses failing due to poor cash flow management or
misunderstanding of cash (U.S. Bank study, widely cited via SCORE and others).

- Forbes (2025-09-14) — "82 percent of businesses fail due to poor cash flow
  management": https://www.forbes.com/sites/melissahouston/2025/09/14/why-running-out-of-cash-is-the-1-reason-businesses-fail
- SCORE via PNC — "82% of all small businesses fail due to cash flow
  problems": https://www.pnc.com/insights/small-business/running-your-business/why-small-businesses-fail.html
- Preferred CFO (2026) breakdown: 82% poor cash flow skills, 79% started with too
  little money, 78% (other): https://preferredcfo.com/insights/cash-flow-reasons-small-businesses-fail-2026

**Ranking of causes** (useful for slide structure):
1. Cash flow problems (82%)
2. Insufficient capital at start (79%)
3. Insufficient demand for product/service (~35%) — US Chamber
4. Management/team problems (~20%)
5. Wrong marketing strategy (22%)

*Source: US Chamber of Commerce, 2025-04-23 —
https://www.uschamber.com/co/start/strategy/why-small-businesses-fail*

**Failure to plan / no business plan** is consistently listed first among
pre-emptive causes: NFIB states companies with a plan early stand the best
chance of success, and that "detailed market research and a thorough evaluation
of your competitors must be done during the planning process."

**Philippine-specific stress evidence:**
- ADB survey of 3,877 MSMEs (1,804 Philippine): 70.6% of Philippine MSMEs
  temporarily closed during COVID-19 — worst among surveyed countries. 58.8%
  reported zero income; 36.7% had no cash and savings; 42.1% said cash would run
  out within a month; 12.7% applied for bankruptcy.
  https://www.rappler.com/business/adb-study-philippines-closures-layoffs-peers-coronavirus-pandemic
- DTI (2020): 90,000 businesses remained closed, ~6% of registered MSMEs, from a
  survey of 3,000. https://business.inquirer.net/308391/dti-90000-businesses-remain-closed-amid-pandemic
- Only **30% of micro and small enterprises had business continuity plans**, and
  those plans were not responsive to the pandemic. (UNIDO 2022, citing PSA.)

**How this connects to the tool.** The failure causes the research identifies —
cash flow blindness, no planning, no competitor evaluation, insufficient demand
testing — are precisely what the ten weighted categories in
`app/src/lib/scoring.ts` measure. The strongest categories by weight
(`customer-problem` 14%, `financial-viability` 14%, `market-opportunity` 12%)
map to the top causes of failure. That mapping is the argument, and it is
verifiable in the product.

---

## 3. Competitors — the validation/scoring space

This market is **crowded internationally and thin locally.** The local gap is
the opportunity.

### International competitors (all AI-first, all USD-priced)

| Product | Positioning | Free tier | Paid price |
|---|---|---|---|
| [Ideometer](https://ideometer.ai/pricing) | Validate idea in 90s; viability score, competitors, financials, 30-day plan | 1 report/mo | $29/mo Pro |
| [IdeaToLaunch](https://ideatolaunch.co/pricing) | AI market analysis, competitor research, MVP planning | 3 validations/mo | $29 Starter / $79 Pro / $149 Team |
| [Eye-O](https://eyeo.app/pricing) | AI validation with FMEA view | 1 validation | $49/mo Founder; **$199/mo Consultant** |
| [Ideatism](https://ideatism.com/pricing) | Market size, competitors, 7-day plan | 1 analysis | $19/mo Pro; $49 Team |
| [StartupScore](https://www.startupscore.live/) | 5-step AI pipeline, live web data, Build/Pivot/Kill verdict | 25 credits | $14.95 Pro |
| [Validify](https://www.validify.business/) | One-time validation + landing page + ad creatives | Preview | $29–49 one-off |
| [Foundra](https://www.foundra.ai/) | AI strategy workspace | — | $39/mo |
| [Startup Validator](https://startup-validator-zeta.vercel.app/pricing) | 5-parameter score | 3 validations | $9/mo (waitlist) |
| [PHLAZE](https://www.phlaze.com/) | 6-phase framework: score ideas, canvas, pitch builder, revenue calculator, tasks | Plan + Hustle | $9.99/mo Pro; $29.99 Pro+; $499 lifetime |

### What competitors do NOT do

1. **Almost all are AI/LLM-generated reports.** No primary data, no structured
   scoring instrument, no reproducible weights. Output is prose.
2. **None are priced in Philippine pesos.** The whole tier ladder is $9–$199 USD.
   At roughly ₱58/USD, PHLAZE Pro+ is ~₱1,740/mo and Eye-O Consultant is
   ~₱11,500/mo — priced for a different market.
3. **None cite local Philippine data.** No PSA, DTI, or local MSME statistics.
4. **Almost none serve existing businesses.** They are pre-launch idea
   validators. PHLAZE (Business Canvas) and Eye-O (team assessment) come
   closest.
5. **Only PHLAZE claims local-first storage** — "All data stored locally on your
   device. No account required." That is a direct competitor to the offline,
   no-account positioning, and it is worth knowing before claiming uniqueness.

### Local / Philippine substitutes for software

The real competitor is not another app — it is **free human advice**:

- **DTI / SBDC** — government business advisory, largely free; MSME Caravan has
  trained 46,000+ owners. Access Partnership (2023):
  https://accesspartnership.com/wp-content/uploads/2023/01/philippines-economic-impact-exec-summary.pdf
- **Local consultants and CPAs** — bookkeeping/accounting firms typically offer
  a free 30-minute consultation, then hourly rates. Example: KG Consult Group
  states "Initial consultation for maximum of 30 minutes is always free,"
  thereafter hourly: https://kgconsult-ph.com/faqs
- **Facebook groups and peer advice** — high adoption, zero cost, no structure.

**Consulting cost anchor (international, for context only):** management
consultants typically run $100–$350+/hour, $3,000–$15,000+/month retainers
(Phoenix MI, 2026). Locally, PayScale lists the average Philippines consulting
base hourly rate at ₱174.96 (https://www.payscale.com/research/PH/Industry=Consulting/Hourly_Rate),
and Filipino freelancer guidance commonly anchors around ₱150–250/hour
(thebusinessmanual.ph, 2026). Human advisory is therefore **not cheap**
relative to local income.

**The gap this suggests.** No one appears to offer a structured, reproducible,
peso-priced assessment instrument that works offline with no account. That is a
defensible position — but it must be argued from the competitive evidence, not
assumed.

---

## 4. Digital adoption — the distribution problem

This matters because it determines both *reach* and *why an offline tool is
correct*.

**DTI Baseline Survey on Digitalization of MSMEs (400 MSMEs, NCR/III/IV-A):**
- 23% do not utilise ICT tools for business at all
- 51% are at Level 1 (basic only — email, Office, PC)
- Only 6% use purely online business or advanced tools (ERP, CRM, analytics)
- 26% are aware of government digitalization programmes
- MSMEs rate importance of digital innovation at 3.6/5

https://ecommerce.dti.gov.ph/madali/baseline_survey.html

**Adoption by tool type (Philippine MSMEs, estimated):**

| Tool | Adoption |
|---|---|
| Social media marketing | 80% |
| Digital payments | 70% |
| E-commerce | 65% |
| Mobile apps | 60% |
| Cybersecurity | 50% |
| Cloud computing | 45% |
| ERP systems | 30% |
| AI-based analytics | 25% |

*Source: "Digital Innovation and Entrepreneurial Success in the Philippine MSME
Sector," 2025 —
https://reference-global.com/download/article/10.2478/eoik-2025-0056.pdf*

**Barriers:** financial constraints cited by 60% of respondents (highest severity,
4.8/5); regulatory issues 30%; cybersecurity concerns.

**DAI country brief (1,000 Philippine MSME owners/managers, 2022):** poor or no
internet connectivity was the most frequently reported difficulty in using
digital tools — 61% among online MSMEs. Offline MSMEs additionally reported
knowledge gaps and low confidence in using tools.
https://www.dai.com/uploads/final-msme-reports/philippines-country-brief.pdf

**Conclusion for the product.** Roughly half of MSMEs sit at the lowest
digital-maturity level, connectivity is a live barrier, and financial constraints
are the top barrier to adoption. Two consequences:
1. An **offline, no-account** product is not a limitation — it matches the market.
2. **Mobile-first** matters more than desktop. The web build already works;
   mobile reach is a distribution question worth answering.

---

## 5. Evidence gaps — research still needed

These are open. None are blocking, but each would strengthen the submission.

- [ ] **Most recent PSA MSME statistics** (2025 LE release) — the 2024 DTI
      figures were confirmed; check whether a newer year is published.
- [ ] **Actual business closure/survival statistics** for the Philippines.
      Nothing above gives a clean annual closure rate. The DTI and ADB figures
      are COVID-period. Do **not** present a pandemic closure rate as a normal-
      year failure rate.
- [ ] **Confirm the 82% cash-flow figure's original study.** It traces to U.S.
      Bank via SCORE, is widely repeated, and is *US* data being applied to a
      Philippine market. Citing it as Philippine evidence would be a
      misattribution judges may catch.
- [ ] **Philippine MSME failure-cause study.** The failure-cause rankings above
      are largely international. A Philippine-specific source would be much
      stronger for criterion 3.
- [ ] **Willingness to pay.** No survey of what a Philippine MSME owner would pay
      for a business evaluation tool. All competitor prices are USD.
- [ ] **Validate the "no local competitor" claim** by searching Filipino-language
      material, DTI-accredited consultants, and local startup directories.

---

## 6. Judge-facing source list

Government and official:
- DTI Statistics — https://www.dti.gov.ph/dti-knowledge-hub/dti-statistics
- DTI Baseline Survey on Digitalization —
  https://ecommerce.dti.gov.ph/madali/baseline_survey.html
- PSA, 2024 Philippine MSME Statistics (via DTI, above)

Research:
- ADB via Rappler (2020) — https://www.rappler.com/business/adb-study-philippines-closures-layoffs-peers-coronavirus-pandemic
- UNIDO (2022), Outlook and Trends for Philippine MSMEs —
  https://sdgs.un.org/sites/default/files/2022-05/Teddy%20Monroy%2C%20UNIDO%2C%20Outlook%20and%20Trends%20for%20Philippine%20MSMEs%20in%20the%20Evolving%20Business%20Landscape.pdf
- Access Partnership (2023) —
  https://accesspartnership.com/wp-content/uploads/2023/01/philippines-economic-impact-exec-summary.pdf
- DAI Philippines MSME country brief (2022) —
  https://www.dai.com/uploads/final-msme-reports/philippines-country-brief.pdf
- "Digital Innovation and Entrepreneurial Success in the Philippine MSME
  Sector" (2025) —
  https://reference-global.com/download/article/10.2478/eoik-2025-0056.pdf
- US Chamber of Commerce (2025), causes of small business failure —
  https://www.uschamber.com/co/start/strategy/why-small-businesses-fail
- SCORE via PNC, cash flow as leading failure cause —
  https://www.pnc.com/insights/small-business/running-your-business/why-small-businesses-fail.html

---

## 7. Questions this research raises for the participant

These are for the participant to answer in their own words — they are not
drafts.

1. The largest local competitor is **free human advice** (DTI/SBDC, CPAs),
   not another app. How does a paid tool win against free advice?
2. Nearly half of MSMEs are at the lowest digital-maturity level. Is that your
   market, or is it the reason adoption will be hard?
3. The 82% cash-flow statistic is US data. What Philippine-specific evidence do
   you have that your target customer has this problem?
4. Your top-weighted categories match the top failure causes. Is that
   deliberate design or coincidence — and how would you demonstrate it is
   deliberate?
5. The product serves both failed and successful businesses. Which is the
   *first* customer, and can one assessment instrument credibly serve both?
6. The offline, no-account design is a genuine differentiator against most
   competitors — but it is also what makes payment difficult. How do these two
   facts resolve?