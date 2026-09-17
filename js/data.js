/**
 * data.js
 * Defines the assessment categories, questions, and recommendation text
 * used by the Business Self-Evaluation Tool.
 *
 * HOW TO EXTEND (for you or for opencode):
 *  - Add a new category by pushing a new object into CATEGORIES.
 *  - Each category needs: id, label, icon (emoji), questions[], recommendations{}
 *  - questions[] items are objects: { text, simple }
 *      - text   -> the standard/business wording
 *      - simple -> the plain-language wording for users who want it
 *    Both are Likert 1-5 statements, phrased so that "5 = strongly agree"
 *    is always the GOOD outcome.
 *  - recommendations{} has three keys: weakness, opportunity, strength.
 *    Each one is an object: { text, simple }. They are shown depending on
 *    the computed score band for that category.
 */

const SCORE_BANDS = {
  WEAKNESS_MAX: 2.5,   // avg score <= this => Weakness
  OPPORTUNITY_MAX: 3.8 // avg score <= this (and > WEAKNESS_MAX) => Opportunity
  // anything above OPPORTUNITY_MAX => Strength
};

/*
 * SUBMIT_FORM — where "Submit results" sends the evaluation.
 * Content only (no logic):
 *  - apiUrl: OPTIONAL (Phase 1). POST endpoint for the Azure Functions API,
 *    e.g. "https://<app>.azurestaticapps.net/api/submit". When set, the app
 *    posts the structured evaluation (language + 8 category scores/bands) and
 *    falls back to the form methods below only if the request fails.
 *  - embedUrl: OPTIONAL. The iframe src from Microsoft Forms → Share → Embed,
 *    e.g. "https://forms.office.com/Pages/ResponsePage.aspx?id=<id>&embed=true".
 *    When set, clicking Submit renders the real form inline below the results
 *    (with a Copy results button + optional Open-in-new-tab link) instead of
 *    redirecting. The user pastes the copied results into the form's field.
 *  - formUrl: plain share link to the Microsoft Form, e.g.
 *      "https://forms.office.com/r/AbCd123"
 *    Fallback target when embedUrl is empty — results are copied to the
 *    clipboard and the form is opened for the user to paste them into.
 *    Also powers the "Open form in new tab" link when embedUrl is set.
 *  - prefillTemplate: OPTIONAL. In Microsoft Forms use "⋯ > Get Pre-filled URL",
 *    put a dummy answer in the "Your evaluation results" field, copy that URL,
 *    and paste it here. When set, the app replaces every form-field value
 *    (params starting with "r") with the full results text, so the form opens
 *    already pre-filled. The prefill link is offered as a shortcut alongside
 *    the embedded form when embedUrl is also configured.
 * Leave all fields empty to keep the copy-only behaviour.
 */
const SUBMIT_FORM = {
  apiUrl: "",
  embedUrl: "",
  formUrl: "",
  prefillTemplate: ""
};

/*
 * ANALYZE — optional on-device document analysis (score assist).
 * Config only (no logic); the behavior lives in js/analyzer.js + js/app.js.
 *  - provider: "wllama" (on-device, default), "api" (Phase 1 backend), "mock".
 *  - moduleUrl/wasmUrl: the vendored engine in js/vendor/wllama/ (no CDN).
 *  - modelRepo/modelFile: the GGUF weights, downloaded once from Hugging Face
 *    and cached by the browser. Swap these for a smaller/larger model as needed
 *    (e.g. bartowski/Llama-3.2-1B-Instruct-GGUF → Llama-3.2-1B-Instruct-Q4_K_M.gguf).
 *  - maxChars: how much of the document is sent to the model.
 *  - apiUrl: only used when provider is "api".
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

const CATEGORIES = [
  {
    id: "finance",
    label: "Finance & Cash Flow",
    icon: "💰",
    questions: [
      {
        text: "We have positive cash flow most months.",
        simple: "Most months, money coming in is more than money going out."
      },
      {
        text: "We track financial statements (P&L, balance sheet, cash flow) regularly.",
        simple: "We keep regular records of our income, spending, and what the business owns and owes."
      },
      {
        text: "We have a clear pricing strategy tied to costs and margins.",
        simple: "Our prices cover our costs and give us a reasonable profit on what we sell."
      },
      {
        text: "We maintain a cash reserve for at least 3 months of expenses.",
        simple: "We keep enough saved money to cover at least 3 months of bills if sales drop."
      },
      {
        text: "We know our break-even point and monitor progress toward it.",
        simple: "We know how much we must sell just to cover our costs, and we watch that number."
      }
    ],
    recommendations: {
      weakness: {
        text: "Set up monthly bookkeeping (even a simple spreadsheet or free tool like Wave) and calculate your break-even point. Build a 3-month cash reserve before reinvesting profits.",
        simple: "Start recording your income and expenses every month (a simple spreadsheet is fine). Figure out how much you need to sell just to cover costs, and keep at least 3 months of bills saved before spending profits on new things."
      },
      opportunity: {
        text: "Introduce a rolling 13-week cash flow forecast and review pricing/margins quarterly to catch issues early.",
        simple: "Look ahead about 3 months at the money coming in and going out each week. Every few months, check that your prices still cover your costs and give you a profit."
      },
      strength: {
        text: "Consider using strong financial discipline to negotiate better supplier terms, pursue growth financing, or invest in automation.",
        simple: "Your money habits are in good shape — use that to get better deals from suppliers, get funding to grow, or invest in tools that save you time."
      }
    }
  },
  {
    id: "marketing",
    label: "Marketing & Sales",
    icon: "📣",
    questions: [
      {
        text: "We have a clearly defined target customer/persona.",
        simple: "We know exactly who our ideal customer is."
      },
      {
        text: "We use at least one consistent, measured marketing channel.",
        simple: "We advertise or promote ourselves in at least one regular place, and we can see if it's working."
      },
      {
        text: "We track conversion rate from lead to paying customer.",
        simple: "We track how many people who show interest actually buy from us."
      },
      {
        text: "We have a repeatable sales process (not just ad-hoc selling).",
        simple: "We sell the same way every time, step by step — not off the top of our head."
      },
      {
        text: "We ask customers how they found us and act on that data.",
        simple: "We ask customers how they heard about us and we use that information."
      }
    ],
    recommendations: {
      weakness: {
        text: "Define one clear customer persona and pick a single low-cost channel (e.g., local SEO, referrals, or one social platform) to test consistently for 90 days before adding more channels.",
        simple: "Pick one type of customer to focus on, and choose one cheap way to reach them (word of mouth, one social media platform, or getting found on Google). Stick with it for 90 days before trying anything else."
      },
      opportunity: {
        text: "Document your sales process into simple stages (lead → qualify → propose → close) and start tracking conversion rate per stage to find the biggest drop-off.",
        simple: "Write down the steps of a sale (interested person → talk to them → give a quote → close the deal). Track where you're losing the most people so you can fix that step."
      },
      strength: {
        text: "Explore scaling what already works: paid promotion of your best organic channel, referral incentives, or a CRM to manage volume.",
        simple: "What's working is working — put a little money behind your best advertising, reward people who send you new customers, or use a simple tool to keep track of your sales contacts."
      }
    }
  },
  {
    id: "operations",
    label: "Operations & Processes",
    icon: "⚙️",
    questions: [
      {
        text: "Core processes (fulfillment, service delivery, etc.) are documented.",
        simple: "The important ways we do our work (delivering orders, serving customers, etc.) are written down."
      },
      {
        text: "Work doesn't grind to a halt when one key person is unavailable.",
        simple: "Work keeps moving even if one important person is out sick or away."
      },
      {
        text: "We use some form of task/project tracking (not just memory or texts).",
        simple: "We keep track of our tasks and projects somewhere organized — not just in our heads or text messages."
      },
      {
        text: "We regularly look for bottlenecks and remove them.",
        simple: "We regularly find what slows our work down and fix it."
      },
      {
        text: "Quality issues or customer complaints are logged and reviewed.",
        simple: "When customers have a problem or complain, we write it down and look at it again."
      }
    ],
    recommendations: {
      weakness: {
        text: "Write down your top 3 recurring processes as simple checklists (even in a shared doc). This is the fastest way to reduce key-person dependency.",
        simple: "Write down your 3 most common jobs as simple checklists (even in a shared document). That way anyone on the team can do them, not just one person."
      },
      opportunity: {
        text: "Adopt a lightweight project/task tool (Trello, Asana, or even a shared spreadsheet) and hold a brief weekly review of bottlenecks.",
        simple: "Start using a simple task list (like Trello, Asana, or a shared spreadsheet) and take 15 minutes a week to check what's slowing things down."
      },
      strength: {
        text: "Look into light automation (e.g., Zapier/Power Automate) for your most repetitive documented process to free up staff time.",
        simple: "Look for a way to automate your most repetitive job (tools like Zapier or Power Automate) so your team can spend time on bigger things."
      }
    }
  },
  {
    id: "hr",
    label: "People & Team",
    icon: "🧑‍🤝‍🧑",
    questions: [
      {
        text: "Roles and responsibilities are clear for each team member.",
        simple: "Everyone on the team knows what their job is."
      },
      {
        text: "We have a simple process for hiring and onboarding new people.",
        simple: "We have a simple, set way to hire and train new people."
      },
      {
        text: "We give and receive feedback on performance regularly.",
        simple: "We regularly tell each other how the work is going — both what's good and what could be better."
      },
      {
        text: "Team members understand the business's goals, not just their tasks.",
        simple: "Our team knows where the business is headed, not just their own daily tasks."
      },
      {
        text: "We have a plan for what happens if a key employee leaves.",
        simple: "We know what we'd do if an important team member left."
      }
    ],
    recommendations: {
      weakness: {
        text: "Create one-page role descriptions for each position and schedule a recurring (even monthly) 1-on-1 check-in with each team member.",
        simple: "Write one page for each job explaining what it involves. Set up a short monthly one-on-one chat with each team member."
      },
      opportunity: {
        text: "Introduce a simple quarterly goal-sharing session so the team connects daily tasks to business priorities.",
        simple: "Once every few months, bring the team together for a short talk about the business goals so everyone sees how their daily work connects to them."
      },
      strength: {
        text: "Invest in a light succession/cross-training plan so growth isn't bottlenecked by any single person, including you.",
        simple: "Teach more than one person each key job so the business can't stall if one person (including you) is away. Then you're free to grow."
      }
    }
  },
  {
    id: "technology",
    label: "Technology & Innovation",
    icon: "💻",
    questions: [
      {
        text: "We use digital tools to reduce manual/repetitive work.",
        simple: "We use computers and apps to cut down on boring, repetitive work."
      },
      {
        text: "Our customer/business data is backed up and reasonably secure.",
        simple: "Our important files and customer info are safely saved and protected."
      },
      {
        text: "We regularly evaluate new tools or methods relevant to our industry.",
        simple: "We regularly check out new tools or ways of working that could help our type of business."
      },
      {
        text: "We have a usable website or digital presence customers can find.",
        simple: "Customers can find us online (website, social media, or a good Google listing)."
      },
      {
        text: "We could recover quickly if a laptop, phone, or system failed today.",
        simple: "If our computer, phone, or system broke today, we could get back to work quickly."
      }
    ],
    recommendations: {
      weakness: {
        text: "Start with the basics: enable automatic backups for critical files (cloud drive is fine) and set up a free/low-cost website or listing (e.g., Google Business Profile).",
        simple: "Start simple: turn on automatic backup for important files (a cloud drive is fine) and set up a free online listing (like a Google Business Profile) so customers can find you."
      },
      opportunity: {
        text: "Pilot one tool that removes a manual task (invoicing, scheduling, inventory) and measure the time saved before rolling out more.",
        simple: "Try one app that does a boring job for you (like sending bills, booking appointments, or tracking stock). See how much time it saves before adding more."
      },
      strength: {
        text: "Explore data-driven decision-making: light analytics dashboards or AI-assisted tools (like this one!) to keep improving.",
        simple: "Use the numbers and easy-to-read dashboards (or helpful AI tools, like this one) to keep making things better."
      }
    }
  },
  {
    id: "customer",
    label: "Customer Experience",
    icon: "⭐",
    questions: [
      {
        text: "We actively collect customer feedback (surveys, reviews, conversations).",
        simple: "We regularly ask customers what they think (through surveys, reviews, or just asking)."
      },
      {
        text: "We have a defined way to handle complaints or service failures.",
        simple: "We have a set way to handle customer complaints or when something goes wrong."
      },
      {
        text: "We know our customer retention/repeat-purchase rate.",
        simple: "We know how many of our customers come back and buy again."
      },
      {
        text: "Customers can reach us easily through their preferred channel.",
        simple: "Customers can easily get in touch with us the way they prefer."
      },
      {
        text: "We use feedback to actually change something in the business.",
        simple: "When customers tell us something, we actually use it to make changes."
      }
    ],
    recommendations: {
      weakness: {
        text: "Add one lightweight feedback loop this month: a 2-question survey after purchase, or simply asking your next 10 customers directly.",
        simple: "This month, get feedback one easy way — a quick 2-question survey after someone buys, or just ask your next 10 customers in person."
      },
      opportunity: {
        text: "Start tracking a basic repeat-customer rate and set a simple complaint-handling script so responses are consistent.",
        simple: "Start keeping track of how many customers come back to buy again, and write down a simple, friendly way to respond to complaints so every customer gets the same good treatment."
      },
      strength: {
        text: "Turn happy customers into growth: build a referral or review-generation habit into your service delivery.",
        simple: "Use your happy customers to grow: get into the habit of asking satisfied customers for reviews or to send friends your way."
      }
    }
  },
  {
    id: "strategy",
    label: "Strategy & Planning",
    icon: "🧭",
    questions: [
      {
        text: "We have a written (even if simple) business plan or goals for the year.",
        simple: "We have our goals for the year written down, even if it's just simple."
      },
      {
        text: "We track a small number of key metrics tied to those goals.",
        simple: "We measure a few simple numbers that tell us whether we're reaching our goals."
      },
      {
        text: "We review progress against goals at least quarterly.",
        simple: "At least every few months, we check how we're doing against our goals."
      },
      {
        text: "We understand our top 2-3 competitors and how we differ.",
        simple: "We know our main competitors and what makes us different from them."
      },
      {
        text: "We have identified at least one new opportunity worth exploring.",
        simple: "We've found at least one new chance to grow worth looking into."
      }
    ],
    recommendations: {
      weakness: {
        text: "Write a one-page plan: 3 goals for the next 12 months, and 1 metric per goal to track monthly.",
        simple: "Write a one-page plan: pick 3 goals for the next year, and one simple number to watch for each goal each month."
      },
      opportunity: {
        text: "Schedule a recurring quarterly review (even 60 minutes) to check metrics against goals and adjust.",
        simple: "Set aside an hour every few months to check your numbers against your goals and adjust as needed."
      },
      strength: {
        text: "Use your planning discipline to formally evaluate the new opportunity you've identified — a small pilot or test is a strong next step.",
        simple: "You plan well — use that to test the new opportunity you found. A small trial is the smartest next step."
      }
    }
  },
  {
    id: "legal",
    label: "Legal & Compliance",
    icon: "⚖️",
    questions: [
      {
        text: "We maintain the required licenses, permits, and registrations for our business.",
        simple: "We keep all the licenses, permits, and registrations our business legally needs."
      },
      {
        text: "Our contracts, terms, and agreements are reviewed for legal soundness.",
        simple: "The contracts and agreements we sign are checked so they are fair and legal."
      },
      {
        text: "We comply with the data protection and privacy rules that apply to us.",
        simple: "We keep customer and employee information private and follow the rules for handling it."
      },
      {
        text: "Our tax filings and required regulatory reports are kept up to date.",
        simple: "We file our taxes and required business reports on time."
      },
      {
        text: "We follow employment and workplace-safety rules for our team.",
        simple: "We follow the rules about hiring, pay, and keeping the workplace safe."
      }
    ],
    recommendations: {
      weakness: {
        text: "Run a basic legal-and-licensing checklist: confirm every required license/registration, set reminders for renewal dates, and have contracts reviewed by a small-business legal resource. Keep one folder with each registration and its due date.",
        simple: "Make a simple list of every license, permit, and registration your business needs, with its renewal date. Before signing important contracts, have a small-business lawyer (or a reputable online service) take a quick look. Keep all the paperwork in one folder."
      },
      opportunity: {
        text: "Introduce an annual compliance review (licenses, taxes, privacy, contracts) and use a consistent simple contract template so repeat agreements are safe and consistent.",
        simple: "Once a year, do a quick check that your licenses, taxes, and privacy paperwork are all up to date. Use a standard, simple contract for repeat agreements so nobody has to reinvent one each time."
      },
      strength: {
        text: "Turn your strong compliance footing into a trust advantage: formalize a compliance calendar, document your privacy approach, and highlight these as trust signals with customers and partners.",
        simple: "You are on top of the legal basics — put your compliance tasks on a simple calendar, write down how you protect customer information, and tell customers and partners about it as a sign of trust."
      }
    }
  }
];