/**
 * data.js
 * Defines the assessment categories, questions, recommendations, business
 * profile fields, readiness levels, and resilience scenarios for the
 * Business Growth & Resilience Coach.
 *
 * HOW TO EXTEND:
 *  - CATEGORIES: push a new category object { id, label, icon, questions[],
 *    recommendations{} } and optionally `help` (a one-line tooltip shown next
 *    to the section title). questions[] items are { text, simple }. text is
 *    the business wording; simple is the plain-language version used by the
 *    ⓘ overlay. Keep "5 = strongly agree / fully in place" as the GOOD end.
 *  - recommendations{} has keys weakness / opportunity / strength, each
 *    { text, simple }. They are used by the dashboard and fed into the
 *    action-plan and roadmap suggestions.
 *  - PROFILE_FIELDS: opening "about your business" step. Each field has a
 *    key, label, type (text | select), optional `options` (for selects),
 *    and a `required` flag.
 *  - SCENARIOS: optional resilience scenarios. Each has id, label, icon,
 *    description, and the six recovery prompts shown in Phase 5.
 *  - READINESS_LEVELS: bands that translate the overall 0-100 score into
 *    supportive guidance. Everything in here stays encouraging.
 */

const SCORE_BANDS = {
  WEAKNESS_MAX: 2.5,
  OPPORTUNITY_MAX: 3.8
};

/* Readiness levels from the overall 0-100 score. Always supportive. */
const READINESS_LEVELS = [
  { min: 80, label: "Well positioned to grow", hint: "You have a strong foundation. Focus on momentum and protecting what is working." },
  { min: 60, label: "Building momentum", hint: "Solid progress. A few focused actions can strengthen this part of the business." },
  { min: 40, label: "Take your next step", hint: "You have a good foundation in several areas. Choose one priority and build." },
  { min: 0, label: "Laying your foundation", hint: "Every business starts here. Pick one small improvement and keep the habits consistent." }
];

/*
 * MANAGED_ACCESS — opt-in, sign-in-gated deployments (Azure Static Web Apps).
 * When `enabled` is false (default) the app is the original privacy-first
 * local tool: no accounts, no server. When a deployment sets it to true, the
 * app runs behind SWA's Entra ID sign-in and `js/managed.js` gates the shell
 * until the signed-in user completes one-time onboarding. Content only.
 */
const MANAGED_ACCESS = {
  enabled: false,
  apiBase: "/api",
  authEndpoint: "/.auth/me",
  signInPath: "/.auth/login/aad",
  signOutPath: "/.auth/logout",
  allowedTenantId: "",
  displayNameMax: 120,
  importMaxBytes: 524288,
  languages: [
    { value: "simple", label: "Plain language" },
    { value: "standard", label: "Standard wording" }
  ],
  recognizedRoles: ["Evaluator", "Reviewer", "Administrator"],
  allowGuestImport: false
};

/*
 * SUBMIT_FORM — where "Submit results" sends the evaluation.
 * Content only (no logic); either empty for copy-only behaviour, or configured
 * with apiUrl / embedUrl / formUrl / prefillTemplate (see comments in the
 * original tool for the full contract). Kept for continuity.
 */
const SUBMIT_FORM = {
  apiUrl: "",
  embedUrl: "",
  formUrl: "",
  prefillTemplate: ""
};

/*
 * ANALYZE — optional on-device document analysis (score assist).
 * Config only; behavior lives in js/analyzer.js + js/app.js.
 */
const ANALYZE = {
  provider: "wllama",
  moduleUrl: "js/vendor/wllama/index.min.js",
  wasmUrl: "js/vendor/wllama/wasm/wllama.wasm",
  modelRepo: "bartowski/Qwen2.5-1.5B-Instruct-GGUF",
  modelFile: "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
  contextSize: 4096,
  temperature: 0.1,
  maxTokens: 900,
  maxChars: 6000,
  apiUrl: ""
};

/*
 * PROFILE_FIELDS — the guided opening step that personalizes the experience.
 * `key` is the storage field; `options` power a <select>; a missing `options`
 * means a free-text <input>. All are stored under coach-profile-v1.
 */
const PROFILE_FIELDS = [
  { key: "businessName", label: "Business name", type: "text", required: true, placeholder: "e.g. Bluebird Bakery" },
  { key: "industry", label: "Industry", type: "text", required: true, placeholder: "e.g. Food & beverage" },
  {
    key: "stage", label: "Business stage", type: "select", required: true,
    options: ["Starting out", "Early days (1 year or less)", "Growing", "Established", "Scale-up"]
  },
  {
    key: "employeeRange", label: "Employee count", type: "select", required: true,
    options: ["Just me", "2-5", "6-20", "21-50", "51+"]
  },
  { key: "mainGoal", label: "Main goal right now", type: "text", required: false, placeholder: "e.g. Grow revenue by 20% this year" },
  { key: "mainChallenge", label: "Main current challenge", type: "text", required: false, placeholder: "e.g. Limited time for bookkeeping" }
];

/*
 * SCENARIOS — optional resilience prompts. Each renders its own small form in
 * Phase 5 with the six fields below (opsAffected, workaround, responsible,
 * customerComms, recoveryTarget, preventiveAction).
 */
const SCENARIOS = [
  { id: "supplier-loss", label: "Loss of a key supplier", icon: "📦",
    description: "What would you do if your main supplier could not deliver for 30 days?" },
  { id: "closure", label: "Temporary business closure", icon: "🚪",
    description: "How would you handle being unable to trade for a week or two (e.g. storm, fire, illness)?" },
  { id: "data-loss", label: "Loss of business data", icon: "💾",
    description: "Could you recover if your customer list, records, or files disappeared today?" },
  { id: "cash-drop", label: "Sudden cash-flow reduction", icon: "💧",
    description: "What would you do if income dropped sharply for a month?" },
  { id: "key-person-loss", label: "Loss of a key employee", icon: "🧑‍💼",
    description: "What would happen if your most important team member left with no notice?" },
  { id: "cyber", label: "Cybersecurity incident", icon: "🔐",
    description: "How would you respond to a hack, scam, or data breach affecting the business?" }
];

const SCENARIO_FIELDS = [
  { key: "opsAffected", label: "Which operations would be affected?" },
  { key: "workaround", label: "What workaround is available?" },
  { key: "responsible", label: "Who would be responsible?" },
  { key: "customerComms", label: "How will customers be informed?" },
  { key: "recoveryTarget", label: "What recovery target is realistic?" },
  { key: "preventiveAction", label: "What preventive action should we create?" }
];

const CATEGORIES = [
  {
    id: "direction",
    label: "Business Direction",
    icon: "🧭",
    help: "Clarity of purpose, goals, and planning rhythm.",
    questions: [
      { text: "We have a clear picture of where the business is heading over the next 12 months.", simple: "We know the direction we want the business to go over the next year." },
      { text: "Our goals are written down and easy for the team to understand.", simple: "Our goals are written somewhere we can all see and understand." },
      { text: "We review our progress against those goals at least quarterly.", simple: "At least every few months, we check how we are doing against our goals." },
      { text: "We have identified our top 2-3 competitors and what makes us different.", simple: "We know our main competitors and what makes us stand out from them." },
      { text: "We know which opportunities are worth pursuing this year.", simple: "We have a short list of opportunities worth chasing this year." }
    ],
    recommendations: {
      weakness: {
        text: "Start lean: write a one-page plan with up to three goals for the next 12 months and one simple metric per goal. Review it monthly for 15 minutes.",
        simple: "Write one page: pick up to three goals for the next year and one simple number to watch for each. Spend 15 minutes a month checking them."
      },
      opportunity: {
        text: "Build a quarterly review habit: a 60-minute session to check metrics, celebrate progress, and reset priorities.",
        simple: "Set aside an hour every few months to look at your numbers, celebrate what is working, and adjust your next steps."
      },
      strength: {
        text: "Leverage your planning discipline to test one new opportunity with a small pilot before committing more resources.",
        simple: "Use your strong planning habit to try one new opportunity on a small scale before going all in."
      }
    }
  },
  {
    id: "market",
    label: "Customers & Market",
    icon: "👥",
    help: "Understanding, reaching, and keeping the right customers.",
    questions: [
      { text: "We know exactly who our ideal customer is.", simple: "We know exactly who our ideal customer is." },
      { text: "We consistently use at least one channel to reach them and can see what it produces.", simple: "We reach customers through at least one regular channel and can tell if it is working." },
      { text: "We track how many interested people become paying customers.", simple: "We know how many people who show interest actually buy." },
      { text: "We ask customers how they found us and act on that information.", simple: "We ask customers how they heard about us and use the answer." },
      { text: "We regularly collect feedback and use it to improve.", simple: "We regularly ask customers what they think and use it to improve." }
    ],
    recommendations: {
      weakness: {
        text: "Define one clear customer 'person' and pick a single low-cost channel to test consistently for 90 days before adding more.",
        simple: "Pick one type of customer to focus on and one affordable way to reach them. Stick with it for 90 days before trying anything else."
      },
      opportunity: {
        text: "Trace the path from an interested person to a paying customer and find where people drop off, then fix that one step.",
        simple: "Follow the steps someone takes from interested to paying, find where people drop out, and make that one step easier."
      },
      strength: {
        text: "Scale what already works: promote your best channel, add a simple referral ask, or reward repeat customers.",
        simple: "Put a little extra behind what is already working — promote it, ask happy customers to refer you, or reward those who come back."
      }
    }
  },
  {
    id: "financial",
    label: "Financial Health",
    icon: "💰",
    help: "Cash flow, records, pricing, and the reserve that keeps you safe.",
    questions: [
      { text: "Most months, more money comes in than goes out.", simple: "Most months, income is higher than spending." },
      { text: "We keep up-to-date records of income and expenses.", simple: "We keep current records of what we earn and spend." },
      { text: "Our prices cover our costs and leave room for profit.", simple: "Our prices pay for our costs and still leave a profit." },
      { text: "We have a cash reserve for at least three months of expenses.", simple: "We keep enough saved to cover about three months of bills if sales dip." },
      { text: "We know how much we need to sell to break even.", simple: "We know the amount we must sell just to cover costs." }
    ],
    recommendations: {
      weakness: {
        text: "Begin with simple monthly bookkeeping (a spreadsheet is fine) and build a three-month cash reserve before reinvesting profits.",
        simple: "Start with easy monthly records of money in and out. Build up three months of savings before spending profits on new things."
      },
      opportunity: {
        text: "Add a rolling 13-week cash flow view and review your pricing and margins quarterly.",
        simple: "Look about three months ahead at money coming in and out each week, and check prices cover costs every few months."
      },
      strength: {
        text: "Use solid finances as leverage: negotiate better supplier terms, explore growth funding, or invest in tools that save time.",
        simple: "With healthy finances, you can negotiate better deals, look at funding for growth, or invest in time-saving tools."
      }
    }
  },
  {
    id: "operations",
    label: "Operations",
    icon: "⚙️",
    help: "The processes, tools, and people-power behind delivering work.",
    questions: [
      { text: "Our core ways of working are documented and repeatable.", simple: "Our most important jobs are written down so anyone can follow them." },
      { text: "Work keeps moving when one key person is unavailable.", simple: "Work continues even when one important person is out." },
      { text: "We track tasks and projects in an organized way.", simple: "We keep track of tasks in one organized place, not just in our heads." },
      { text: "We regularly find and clear the bottlenecks that slow us down.", simple: "We regularly find what slows us down and fix it." },
      { text: "Quality issues and customer complaints are logged and reviewed.", simple: "We write down problems or complaints and look at them again." }
    ],
    recommendations: {
      weakness: {
        text: "Write your top three recurring jobs as simple checklists in a shared place — the fastest way to reduce dependence on one person.",
        simple: "Turn your three most common jobs into simple checklists everyone can access, so no one person is essential for them."
      },
      opportunity: {
        text: "Adopt a lightweight task tool and hold a short weekly review of what is blocking progress.",
        simple: "Use a simple task app or shared list, and spend a few minutes each week clearing what is blocking progress."
      },
      strength: {
        text: "Automate one repetitive process to free up time, then measure the time it returns to you.",
        simple: "Find one repeatable job a tool can automate, and track how much time it gives back."
      }
    }
  },
  {
    id: "people",
    label: "People & Leadership",
    icon: "🤝",
    help: "Roles, feedback, and keeping the right people in the right places.",
    questions: [
      { text: "Everyone in the business knows what their role and responsibilities are.", simple: "Each person knows exactly what their job involves." },
      { text: "We have a simple, consistent way to hire and welcome new people.", simple: "We have a repeatable process for hiring and training new people." },
      { text: "We give and receive feedback regularly in both directions.", simple: "We regularly share helpful feedback — up, down, and sideways." },
      { text: "The team understands the business goals, not just their daily tasks.", simple: "The team sees where the business is headed, not just their own tasks." },
      { text: "We have an idea of how we would cope if a key person left.", simple: "We have a rough plan for carrying on if a key person left." }
    ],
    recommendations: {
      weakness: {
        text: "Create one-page role descriptions and schedule a regular one-on-one check-in with each team member.",
        simple: "Write a short description of each role and set up a regular one-on-one chat with each person."
      },
      opportunity: {
        text: "Hold a short quarterly session where the team connects daily work to the bigger goals.",
        simple: "Every few months, spend a short session helping the team see how their work supports the goals."
      },
      strength: {
        text: "Deepen your bench strength with simple cross-training so growth never depends on any single person — including you.",
        simple: "Teach a second person each key job, so the business can keep moving no matter who is away."
      }
    }
  },
  {
    id: "technology",
    label: "Technology & Security",
    icon: "💻",
    help: "Tools that save time and the safeguards that protect your data.",
    questions: [
      { text: "We use digital tools that reduce manual or repetitive work.", simple: "We use apps and tools to reduce boring, repetitive work." },
      { text: "Our important data is backed up and reasonably protected.", simple: "Our important files and customer details are safely backed up and protected." },
      { text: "We regularly look at tools or methods that could help our industry.", simple: "We regularly check out tools or methods that could help our type of business." },
      { text: "Customers can find us online through a website or a good listing.", simple: "Customers can find us online — a website, social media, or a good directory listing." },
      { text: "We could get back to work quickly if a device or system failed today.", simple: "If a computer or system failed today, we could recover and keep working quickly." }
    ],
    recommendations: {
      weakness: {
        text: "Start with the essentials: enable automatic backups to a cloud drive and set up a simple online presence or Google Business Profile.",
        simple: "Turn on automatic backups for important files and create a simple online listing so customers can find you."
      },
      opportunity: {
        text: "Pilot one tool that removes a manual task and measure the time it saves before expanding.",
        simple: "Try one app that handles a boring job for you, and see how much time it saves before adding more."
      },
      strength: {
        text: "Use good systems to make data-driven decisions: simple dashboards or AI-assisted tools to keep improving.",
        simple: "Use your reliable systems and simple dashboards to keep making things better with data."
      }
    }
  },
  {
    id: "risk",
    label: "Risk & Business Continuity",
    icon: "🛡️",
    help: "Your ability to keep operating when something unexpected happens.",
    questions: [
      { text: "The business could keep operating if a key supplier or partner failed.", simple: "We could keep working if a major supplier or partner let us down." },
      { text: "We have thought through what we would do if we had to close for a short time.", simple: "We have a rough plan for handling a short closure." },
      { text: "Critical customer information and records would survive a data loss event.", simple: "Our key records and customer details would survive losing our files." },
      { text: "We could absorb a sudden drop in income for a month or two.", simple: "We could manage if income suddenly dropped for a month or two." },
      { text: "We have identified the risks most likely to affect us and made plans for them.", simple: "We have named our biggest risks and planned for them." }
    ],
    recommendations: {
      weakness: {
        text: "Write a 'keep going' plan in half a page: what could stop you, and the first step you would take for each.",
        simple: "Write a short plan: what could stop the business, and your first move for each one."
      },
      opportunity: {
        text: "Test one of your 'what if' plans this quarter — for example, a backup recovery drill or a week of documented checklists.",
        simple: "This quarter, actually practise one of your 'what if' plans, like recovering from a backup or completing checklists."
      },
      strength: {
        text: "Turn your continuity strength into a promise you share: document your approach and offer it as a trust signal to customers and partners.",
        simple: "You are well prepared — write down how you stay resilient and share it with customers and partners as trust."
      }
    }
  },
  {
    id: "innovation",
    label: "Innovation & Growth",
    icon: "🚀",
    help: "Fresh ideas, improvements, and a path to responsible growth.",
    questions: [
      { text: "We regularly try small improvements to how we do things.", simple: "We regularly try small improvements to the way we work." },
      { text: "We have at least one new idea or offering we are exploring.", simple: "We are exploring at least one new idea, product, or service." },
      { text: "We learn from what does and does not work without blaming anyone.", simple: "We learn from successes and setbacks, and nobody gets blamed." },
      { text: "We have room in the plan for a controlled amount of growth.", simple: "Our plan has room for growth we can handle." },
      { text: "We keep an eye on trends in our industry and adapt when they matter.", simple: "We watch what is changing in our industry and adapt when it matters." }
    ],
    recommendations: {
      weakness: {
        text: "Make room for one small experiment this month — a product tweak, a new offer, or a better way to do one task — and capture one learning.",
        simple: "Try one small experiment this month, whatever it is, and write down one thing you learned from it."
      },
      opportunity: {
        text: "Create a simple 'ideas list' and review it monthly, choosing one idea to test every quarter.",
        simple: "Keep a simple list of ideas, look at it monthly, and pick one to try every few months."
      },
      strength: {
        text: "Channel your innovation culture into structured growth: pick your best idea and build a small pilot with clear success measures.",
        simple: "You are great at fresh ideas — choose your best one and turn it into a small pilot with clear measures of success."
      }
    }
  }
];