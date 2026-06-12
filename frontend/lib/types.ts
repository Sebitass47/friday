export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
}

export interface Account {
  id: string
  user_id: string
  name: string
  account_type: 'checking' | 'savings' | 'credit_card'
  balance: number
  currency: string
  is_active: boolean
  credit_limit: number | null
  closing_day: number | null
  payment_day: number | null
  created_at: string
  updated_at: string
}

export interface RecurringExpense {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'custom'
  interval_days: number | null
  created_at: string
  updated_at: string
}

export interface InstallmentPurchase {
  id: string
  user_id: string
  name: string
  total_amount: number
  monthly_amount: number
  total_installments: number
  remaining_installments: number
  start_date: string
  created_at: string
  updated_at: string
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  monthly_contribution: number
  estimated_completion_date: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyIncome {
  id: string
  user_id: string
  amount: number
  created_at: string
  updated_at: string
}

export interface MonthProjection {
  month: number
  year: number
  label: string
  income: number
  recurring_expenses: number
  installments: number
  savings_contributions: number
  available: number
}

export interface ProjectionResponse {
  months: MonthProjection[]
  total_months: number
}

export interface SimulationResponse extends ProjectionResponse {
  impact_summary: number
}
