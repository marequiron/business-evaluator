export interface Profile {
  businessName: string
  businessDescription: string
  problemSolved: string
  productService: string
  targetCustomers: string
  geographicMarket: string
  revenueModel: string
  startupCost: string
  shortTermObjective: string
  longTermVision: string
}

export const EMPTY_PROFILE: Profile = {
  businessName: '',
  businessDescription: '',
  problemSolved: '',
  productService: '',
  targetCustomers: '',
  geographicMarket: '',
  revenueModel: '',
  startupCost: '',
  shortTermObjective: '',
  longTermVision: '',
}

export interface AnswerValue {
  value: number | null
  note: string
}

export type Answers = Record<string, AnswerValue>

export interface Evaluation {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  profile: Profile
  answers: Answers
}

export type View = 'welcome' | 'profile' | 'wizard' | 'results' | 'presentation' | 'manager'