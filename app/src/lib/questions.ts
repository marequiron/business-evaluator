export interface Question {
  text: string
  why: string
  tip: string
}

export interface Category {
  id: string
  label: string
  description: string
  questions: Question[]
  risk: string
  treatment: string
  improveTip: string
}

export const CATEGORIES: Category[] = [
  {
    id: 'customer-problem',
    label: 'Customer Problem',
    description:
      'Whether the problem you solve is real, urgent, and big enough to build a business on.',
    questions: [
      {
        text: 'I can clearly describe the problem my target customers face, in their own words.',
        why: 'A precise problem description is the foundation for every other part of your business.',
        tip: 'Talk to 5 to 10 potential customers and write down exactly how they describe the problem.',
      },
      {
        text: 'I have evidence that enough customers genuinely care about solving this problem to support a business.',
        why: 'Demand must exist before you build. Real evidence beats a confident guess.',
        tip: 'Run a small survey or a pre-order test to measure genuine, paying interest.',
      },
      {
        text: 'The problem is painful or frequent enough that customers actively look for a solution.',
        why: 'You need urgency, not polite interest. Urgent problems create buyers.',
        tip: 'Ask how customers cope with the problem today and what it costs them to ignore it.',
      },
      {
        text: 'I understand the alternatives and substitutes customers use today instead of my idea.',
        why: 'You compete against the status quo, not just against obvious competitors.',
        tip: 'List the current alternatives and note the weaknesses your offer can exploit.',
      },
    ],
    risk: 'The idea may be solving a problem that is not painful or proven enough to generate paying demand.',
    treatment:
      'Validate demand directly: interview at least 10 target customers and run a small paid pilot before investing further.',
    improveTip:
      "verify real demand with customer interviews and a small paid pilot, so you build on evidence rather than assumption.",
  },
  {
    id: 'market-opportunity',
    label: 'Market Opportunity',
    description:
      'How large, reachable, and well-timed the market is for what you are building.',
    questions: [
      {
        text: 'I can name the specific segments of customers I will serve (who they are and where they are).',
        why: 'A focused segment is easier to reach, sell to, and serve than a vague one.',
        tip: 'Define one beachhead customer segment before expanding to others.',
      },
      {
        text: 'I have a reasonable estimate of how many customers and potential sales exist in my market.',
        why: 'You need a market big enough to justify the effort, but small enough to win.',
        tip: 'Estimate bottom-up: number of reachable customers times price times purchase frequency.',
      },
      {
        text: 'The market is growing, underserved, or shifting in a way that opens a window of opportunity for me.',
        why: 'Timing can make or break a launch, and shifts create openings smaller players can seize.',
        tip: 'Review industry reports or local data for growth or unmet needs you can serve.',
      },
      {
        text: 'I can realistically reach my target customers through channels I can afford and manage.',
        why: 'A great offer that nobody can find will not survive.',
        tip: 'List two or three channels and estimate what it costs to acquire a customer through each.',
      },
    ],
    risk: 'The market may be too small, too saturated, or priced out of reach to support sustainable growth.',
    treatment:
      'Quantify your addressable market bottom-up and test whether your chosen channel can reach it at a workable cost.',
    improveTip:
      'quantify the market bottom-up and validate one low-cost channel for reaching your target segment.',
  },
  {
    id: 'value-proposition',
    label: 'Value Proposition',
    description:
      'How clearly and differently your offer creates value that customers actually want.',
    questions: [
      {
        text: 'I can explain, in one sentence, the outcome customers get from my product or service.',
        why: 'Clarity drives your messaging, sales, and product focus all at once.',
        tip: 'Write a one-line promise: [customer] gets [outcome] through [your offer].',
      },
      {
        text: "My offer's benefits are clearly different from what customers already get today.",
        why: "If it is not clearly better or different, it is a commodity that competes on price.",
        tip: 'Compare your top three benefits side by side with the main alternatives.',
      },
      {
        text: 'Customers would notice and feel the loss if my product or service disappeared.',
        why: 'Retention and word of mouth come from being seen as indispensable.',
        tip: 'Ask customers what they would do if you left the market, and improve until the answer hurts.',
      },
      {
        text: 'My pricing reflects the value my customers receive, not just my costs.',
        why: 'Value-based pricing is what funds growth and reinvestment.',
        tip: 'Test a price that reflects outcome value and listen carefully to how customers react.',
      },
    ],
    risk: 'The offer may feel like a nice-to-have rather than something customers strongly prefer and would miss.',
    treatment:
      'Sharpen your one-line promise and test it with customers until they name the benefit back to you and the price feels fair.',
    improveTip:
      'sharpen your one-line promise and test price against value with real customers until they describe the benefit unprompted.',
  },
  {
    id: 'competitive-advantage',
    label: 'Competitive Advantage',
    description:
      'Whether you have a durable edge that competitors and copycats will struggle to match.',
    questions: [
      {
        text: 'I know who my direct and indirect competitors are and how they compete.',
        why: 'You cannot position yourself against competitors you cannot see.',
        tip: 'Map at least five alternatives and note how each one wins or loses.',
      },
      {
        text: 'I have at least one durable advantage competitors cannot easily copy (brand, access, skills, data, location, or relationships).',
        why: 'Advantages that are easy to copy disappear fast.',
        tip: 'Write down what you own that others would struggle to replicate.',
      },
      {
        text: 'I can name the barriers a new entrant would face if they tried to match my offer.',
        why: 'Barriers protect your margins and your market share.',
        tip: 'List what would be hard for a copycat to rebuild: time, capital, trust, or access.',
      },
      {
        text: 'My marketing message clearly signals why I deserve the customer\u2019s choice over alternatives.',
        why: 'Positioning converts attention into sales.',
        tip: 'Draft a launch message that names a specific customer pain and your distinct answer to it.',
      },
    ],
    risk: 'Without a durable edge, the business can become a low-margin commodity that competitors undercut.',
    treatment:
      'Identify and deliberately invest in one advantage that is costly or slow for others to replicate, and make it the core of your message.',
    improveTip:
      'identify one genuinely defensible advantage and make it the center of your positioning and messaging.',
  },
  {
    id: 'operational-feasibility',
    label: 'Operational Feasibility',
    description:
      'How realistically you can deliver your offer reliably, affordably, and at a quality customers expect.',
    questions: [
      {
        text: 'I have mapped the key activities, materials, equipment, and people needed to deliver my offer.',
        why: 'Delivery must actually work before you sell at scale.',
        tip: 'Sketch a simple production or delivery flow, step by step, and note who does what.',
      },
      {
        text: 'I can produce or deliver my offer at the quality and speed customers expect.',
        why: 'Early quality problems are the fastest way to lose trust.',
        tip: 'Run a small prototype or pilot with a few customers and measure speed and quality.',
      },
      {
        text: 'I have, or can easily get, the suppliers, partners, and space I need at costs I can afford.',
        why: 'Missing inputs stall a launch just when you need momentum.',
        tip: 'Confirm quotes and availability for your three most critical inputs this week.',
      },
      {
        text: 'My operations can handle a realistic first rush of customers without breaking.',
        why: 'Success itself can sink an unprepared operation.',
        tip: 'Define what full capacity looks like and which step fails first.',
      },
    ],
    risk: 'Operations may be too fragile, costly, or slow to deliver consistently, causing churn and bad reviews.',
    treatment:
      'Pilot on a small scale, map the delivery flow, and fix the single weakest step before taking on full volume.',
    improveTip:
      'run a small pilot that maps and tests your delivery flow and fixes your weakest step first.',
  },
  {
    id: 'financial-viability',
    label: 'Financial Viability',
    description:
      'Whether the unit economics, break-even point, and cash runway make the business sustainable.',
    questions: [
      {
        text: 'My revenue model is clearly defined (who pays, for what, how much, and how often).',
        why: 'Revenue is how you feed your short-term goals.',
        tip: 'Document price, payment method, and whether revenue is one-off or recurring.',
      },
      {
        text: 'My cost structure is realistic and I know my break-even point.',
        why: 'Break-even tells you exactly what survival requires.',
        tip: 'List your fixed and variable costs and calculate the monthly sales needed to break even.',
      },
      {
        text: 'My startup cost estimate is realistic, itemized, and within my reach.',
        why: 'Under-estimating startup costs sinks more ideas than any other single cause.',
        tip: 'Itemize your startup costs and add a 20 percent buffer.',
      },
      {
        text: 'I have enough cash to cover early expenses before revenues arrive.',
        why: 'The gap between spending and earning causes most early failures.',
        tip: 'Project monthly cash for your first six months and find the low point.',
      },
    ],
    risk: 'The business may run out of cash before revenues arrive or never reach break-even at the planned price.',
    treatment:
      'Model unit economics and a six-month cash projection, then price and cost to reach break-even inside your runway.',
    improveTip:
      'model your unit economics and six-month cash projection, and set a price and cost structure that reaches break-even inside your runway.',
  },
  {
    id: 'risk-resilience',
    label: 'Risk and Business Resilience',
    description:
      'How well the business absorbs shocks from customers, suppliers, channels, and unexpected disruption.',
    questions: [
      {
        text: 'My business would not be crippled by the loss of any single supplier or customer.',
        why: 'Revenue and supply concentration are the quietest killers.',
        tip: 'Identify your largest supplier and largest customer and line up a backup for each.',
      },
      {
        text: 'I have, or am actively building, an emergency cash reserve for at least two to three months of expenses.',
        why: 'A reserve is what turns a shock into a recoverable event instead of a closure.',
        tip: 'Set a target reserve amount and a weekly savings plan to reach it.',
      },
      {
        text: 'I have more than one way to deliver my product or service and to reach customers.',
        why: 'A single channel is a single point of failure.',
        tip: 'Prototype a second sales or delivery channel now, while times are calm.',
      },
      {
        text: 'I have considered business continuity, regulation and permits, cybersecurity, and what happens if I am unavailable.',
        why: 'Small businesses usually fail from small oversights that compound.',
        tip: 'Check the permits you need, back up your data and systems, and write a short \u201cwho runs things if I am out\u201d plan.',
      },
    ],
    risk: 'The business is exposed to a single point of failure (one customer, supplier, channel, or person) with no buffer.',
    treatment:
      'Build a two-to-three-month cash reserve, diversify your top customer, supplier, and channel, and document a continuity plan.',
    improveTip:
      'build your cash reserve, reduce dependence on any single customer, supplier, or channel, and document a simple continuity plan.',
  },
  {
    id: 'sustainability',
    label: 'Sustainability',
    description:
      'Enduring financial health plus positive impact on the environment, community, and people.',
    questions: [
      {
        text: 'My business is designed to remain financially healthy over the long term, not just at launch.',
        why: 'Long-term financial health funds everything else you care about.',
        tip: 'Stress-test your financial model with three scenarios, including a pessimistic one.',
      },
      {
        text: 'I have considered my environmental impact and how to reduce it.',
        why: 'Customers and communities increasingly choose businesses that reduce harm.',
        tip: 'List your biggest resource uses and commit to reducing one in the next quarter.',
      },
      {
        text: 'My business creates clear value for the community where it operates.',
        why: 'Community goodwill is durable marketing that competitors cannot buy.',
        tip: 'Name one concrete community benefit you can genuinely deliver and track.',
      },
      {
        text: 'I plan to support the well-being, fair treatment, and growth of the people I work with.',
        why: 'People build the business, and their turnover silently destroys resilience.',
        tip: 'Write a simple people policy covering pay, growth, and how feedback is heard.',
      },
    ],
    risk: 'The business may be financially fragile or out of step with the environmental and social expectations of its customers.',
    treatment:
      'Stress-test the financial model, commit to one measurable environmental improvement, and document a simple people and community policy.',
    improveTip:
      'stress-test your finances, commit to one measurable environmental improvement, and document how you will treat people and community well.',
  },
  {
    id: 'scalability-growth',
    label: 'Scalability and Long-Term Growth',
    description:
      'How well the offer and operations can grow without costs or effort exploding equally.',
    questions: [
      {
        text: 'My offer can serve more customers without a proportional explosion in cost or effort.',
        why: 'Scalability, not size, is what defines your growth potential.',
        tip: 'Identify the steps you repeat manually today and note which could be standardized or automated.',
      },
      {
        text: 'I have a clear vision for how the business grows over the next three to five years.',
        why: 'Long-term goals are what keep short-term decisions consistent.',
        tip: 'Write a three-sentence growth vision and a single first milestone to reach it.',
      },
      {
        text: 'My operations and systems can be handed to other people as the business grows.',
        why: 'If everything depends on you, growth stalls the moment you are stretched.',
        tip: 'Document one process you could delegate completely this month.',
      },
      {
        text: 'I can adapt to market and customer changes such as shifts in demand, technology, or habits.',
        why: 'Adaptability is the strongest predictor of long-term survival.',
        tip: 'Schedule a quarterly review of what has changed in your market and what that means for you.',
      },
    ],
    risk: 'Growth may stall because delivery, delegation, or adaptability are all tied to the founder or manual systems.',
    treatment:
      'Standardize repeatable steps, document processes you can delegate, and set a written three-to-five-year growth milestone.',
    improveTip:
      'standardize the manual steps, document processes you can delegate, and set a written long-term growth milestone.',
  },
  {
    id: 'founder-readiness',
    label: 'Founder Readiness',
    description:
      'Your own commitment, self-awareness, support network, and capacity to delegate.',
    questions: [
      {
        text: 'I clearly understand what I am good at and what I would need help or training with.',
        why: 'Honest self-knowledge tells you where to invest time and money first.',
        tip: 'Write a short list of your strengths and your two biggest gaps.',
      },
      {
        text: 'I have committed the time, energy, and resources required to launch and to persist through setbacks.',
        why: 'Businesses almost always take longer than planned.',
        tip: 'Check your launch plan against the time you genuinely have available each week.',
      },
      {
        text: 'I have, or can build, the support system, mentors, and advisors I need.',
        why: 'Isolation is one of the top causes of founder burnout.',
        tip: 'Identify one mentor or peer group to connect with in the next 30 days.',
      },
      {
        text: 'I have a plan for how responsibilities will be shared or delegated beyond day one.',
        why: 'Founder succession and delegation plans are what let the business outgrow one person.',
        tip: 'Name the first role you would hire or delegate and when you would do it.',
      },
    ],
    risk: 'Everything may depend on one founder who could burn out or become unavailable, halting the business.',
    treatment:
      'Name your own gaps, build a small advisory circle, and define the first role you will delegate to someone else.',
    improveTip:
      'name your biggest gaps, line up one mentor or advisor, and define the first role you will delegate.',
  },
]

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}