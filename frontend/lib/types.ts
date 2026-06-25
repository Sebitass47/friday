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
  current_balance_used: number | null
  available_credit: number | null
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
  account_id: string | null
  name: string
  total_amount: number
  monthly_amount: number
  total_installments: number
  remaining_installments: number
  start_date: string
  paid_month: number | null
  paid_year: number | null
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

export interface Expense {
  id: string
  user_id: string
  account_id: string
  name: string
  amount: number
  date: string
  payment_method: 'cash' | 'debit' | 'credit'
  category: string | null
  credit_statement_month: number | null
  credit_statement_year: number | null
  paid: boolean
  created_at: string
  updated_at: string
}

export interface CreditPayment {
  id: string
  user_id: string
  account_id: string
  amount_paid: number
  payment_date: string
  statement_month: number
  statement_year: number
  created_at: string
}

export interface Income {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  updated_at: string
}
