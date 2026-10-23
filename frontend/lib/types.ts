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
  account_id: string | null
  name: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'custom'
  interval_days: number | null
  last_charged_date?: string | null
  // Other people's parts of each charge (amount is YOUR part)
  shares?: ExpenseShare[]
  // What is charged each time: your part + everyone else's
  total_amount?: number | null
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
  // Other people's parts of each monthly payment (monthly_amount is YOUR part)
  shares?: InstallmentShare[]
  // What the card is charged each month: your part + everyone else's
  total_monthly?: number | null
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
  contributed_month: number | null
  contributed_year: number | null
  last_contribution_amount: number | null
  estimated_completion_date: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyIncome {
  id: string
  user_id: string
  account_id: string | null
  amount: number
  cycle_start_day: number
  created_at: string
  updated_at: string
}

export interface MonthProjection {
  month: number
  year: number
  label: string
  cycle_start: string
  cycle_end: string
  income: number
  recurring_expenses: number
  installments: number
  savings_contributions: number
  cash_debit_spent: number
  credit_spent: number
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
  payment_method: 'cash' | 'debit' | 'credit' | 'savings'
  category: string | null
  credit_statement_month: number | null
  credit_statement_year: number | null
  paid: boolean
  // `amount` is YOUR part; the bank is charged total_amount (your part + shares)
  total_amount?: number | null
  shares?: ExpenseShare[]
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
  account_id: string | null
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string | null
  label: string | null
  color: string
  is_pinned: boolean
  is_owner: boolean
  owner_email: string | null
  owner_name: string | null
  shared_with: SharedUser[]
  created_at: string
  updated_at: string
}

export interface SharedUser {
  id: string
  email: string
  name: string
}

// Present on every shareable resource (reminders, events, lists)
export interface SharingInfo {
  is_owner: boolean
  owner_email: string | null
  owner_name: string | null
  shared_with: SharedUser[]
}

export interface ListItem {
  id: string
  list_id: string
  text: string
  is_done: boolean
  position: number
  created_at: string
}

export interface UserList {
  id: string
  user_id: string
  name: string
  emoji: string
  items: ListItem[]
  is_owner: boolean
  owner_email: string | null
  owner_name: string | null
  shared_with: SharedUser[]
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string | null
  label: string | null
  is_event: boolean
  due_date: string | null
  due_time: string | null
  location: string | null
  is_starred: boolean
  is_completed: boolean
  recurrence: string | null
  reminder_at: string | null
  remind_day_before: boolean
  subtasks: Subtask[]
  is_owner: boolean
  owner_email: string | null
  owner_name: string | null
  shared_with: SharedUser[]
  created_at: string
  updated_at: string
}

export interface CustomCategory {
  id: string
  name: string
}

export interface CategoriesResponse {
  default: string[]
  custom: CustomCategory[]
}

export interface Habit {
  id: string
  name: string
  color: string
  created_at: string
  // Weekdays the habit applies to: 0=Mon … 6=Sun
  days: number[]
  completed_dates: string[]
  week_percentage: number
}

// ── Statistics ───────────────────────────────────────────────────────────────

export interface PerHabitStat {
  id: string
  name: string
  color: string
  week_pct: number
  month_pct: number
  streak: number
  best_streak: number
}

export interface HeatCell {
  date: string
  done: number
  scheduled: number
}

export interface HabitStats {
  week_pct: number
  month_pct: number
  streak_days: number
  best_streak_days: number
  perfect_days_30: number
  // 0 = Monday
  best_weekday: number | null
  worst_weekday: number | null
  per_habit: PerHabitStat[]
  heatmap: HeatCell[]
  weekly: { week_start: string; pct: number }[]
}

export interface ReminderWindow {
  done: number
  missed: number
  pct: number
}

export interface ReminderStats {
  week: ReminderWindow
  month: ReminderWindow
  overdue_now: number
}

export interface ListStats {
  checked_week: number
  checked_month: number
  pending_items: number
  total_items: number
  lists: number
  lists_complete: number
}

export interface CycleStat {
  label: string
  start: string
  end: string
  income: number
  spent: number
  net: number
  is_current: boolean
}

export interface FinanceStats {
  cycles: CycleStat[]
  spent_current: number
  spent_prev_same_point: number
  spent_vs_prev_pct: number | null
  avg_daily_spend: number
  categories: { category: string; amount: number; prev_amount: number }[]
}

export interface Stats {
  habits: HabitStats | null
  reminders: ReminderStats
  lists: ListStats
  finance: FinanceStats | null
}

export interface DigestSettings {
  enabled: boolean
  sunday_on: boolean
  sunday_hour: number
  friday_on: boolean
  friday_hour: number
}

// ── People & shared charges ──────────────────────────────────────────────────

export interface Person {
  id: string
  name: string
  pending_total: number
  pending_count: number
}

export interface ExpenseShare {
  person_id: string
  person_name: string
  amount: number
  settled: number
}

export interface InstallmentShare {
  person_id: string
  person_name: string
  monthly_amount: number
}

export interface PendingDebt {
  id: string
  description: string
  amount: number
  pending: number
  charge_date: string
  source: 'expense' | 'installment' | 'recurring'
  account_name: string | null
}

export interface PersonPayment {
  id: string
  person_id: string
  person_name: string
  amount: number
  date: string
  account_id: string | null
  note: string | null
  allocated: { debt_id: string; description: string; amount: number }[]
  unallocated: number
}

export interface ClosingPerson {
  person_id: string
  person_name: string
  owed: number
  settled: number
  pending: number
}

export interface ClosingCharge {
  kind: 'expense' | 'installment' | 'recurring'
  id: string
  name: string
  date: string
  mine: number
  total: number
  shares: { person_id: string; person_name: string; amount: number; settled: number }[]
  // Recurring charge computed from the recurring expense (never logged for this statement)
  estimated?: boolean
}

export interface ClosingCard {
  account_id: string
  name: string
  closing_day: number
  payment_day: number | null
  period_start: string
  period_end: string
  total: number
  mine: number
  others: number
  msi_total: number
  paid: number
  real_total: number | null
  // real_total - total: > 0 means something is missing in FRIDAY
  difference: number | null
  people: ClosingPerson[]
  charges: ClosingCharge[]
}

export interface Closing {
  month: number
  year: number
  label: string
  cards: ClosingCard[]
  total: number
  mine: number
  others: number
  to_collect: number
  people: ClosingPerson[]
}
