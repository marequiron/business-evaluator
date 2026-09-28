import type { Profile } from '../types'

export interface ProfileField {
  key: keyof Profile
  label: string
  placeholder: string
  help: string
  type: 'text' | 'textarea' | 'cost'
}

export const PROFILE_FIELDS: ProfileField[] = [
  {
    key: 'businessName',
    label: 'Business name',
    placeholder: 'e.g. FreshNest Meal Kits',
    help: 'A working name is fine; you can change it later.',
    type: 'text',
  },
  {
    key: 'businessDescription',
    label: 'Business description',
    placeholder: 'What does the business do, in two or three sentences?',
    help: 'Describe the business as you would to a smart friend.',
    type: 'textarea',
  },
  {
    key: 'problemSolved',
    label: 'Problem being solved',
    placeholder: 'What real, painful problem are you removing for customers?',
    help: 'Problem clarity drives every later score.',
    type: 'textarea',
  },
  {
    key: 'productService',
    label: 'Proposed product or service',
    placeholder: 'What exactly will you offer customers?',
    help: 'Describe the tangible offer, not just the idea.',
    type: 'textarea',
  },
  {
    key: 'targetCustomers',
    label: 'Target customers',
    placeholder: 'Who specifically will you serve?',
    help: 'Be specific: age, role, habits, location.',
    type: 'textarea',
  },
  {
    key: 'geographicMarket',
    label: 'Geographic market',
    placeholder: 'e.g. Metro area, national, or global online',
    help: 'Where do your customers live and buy?',
    type: 'text',
  },
  {
    key: 'revenueModel',
    label: 'Revenue model',
    placeholder: 'How will you make money and get paid?',
    help: 'e.g. subscription, one-off sale, commission, license.',
    type: 'textarea',
  },
  {
    key: 'startupCost',
    label: 'Estimated startup cost',
    placeholder: 'e.g. 25000',
    help: 'Your realistic estimate of cash needed to launch. Numbers only.',
    type: 'cost',
  },
  {
    key: 'shortTermObjective',
    label: 'Short-term objective',
    placeholder: 'What will the business achieve in the first 6 to 12 months?',
    help: 'Make it specific and measurable.',
    type: 'textarea',
  },
  {
    key: 'longTermVision',
    label: 'Long-term vision',
    placeholder: 'Where will this business be in 3 to 5 years?',
    help: 'The destination that keeps short-term decisions consistent.',
    type: 'textarea',
  },
]