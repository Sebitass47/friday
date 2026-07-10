import type {
  User, Account, RecurringExpense, InstallmentPurchase,
  SavingsGoal, MonthlyIncome, ProjectionResponse, SimulationResponse,
  Expense, CreditPayment, Income, Task, Subtask, Note,
  CategoriesResponse, CustomCategory,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1'

function token(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    throw new Error('No autorizado')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const form = new FormData()
  form.append('username', email)
  form.append('password', password)
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Error al iniciar sesión')
  }
  return res.json()
}

export async function register(email: string, password: string, fullName: string): Promise<User> {
  return req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  })
}

export async function getMe(): Promise<User> {
  return req('/auth/me')
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  return req('/accounts/')
}
export async function createAccount(data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'available_credit'>): Promise<Account> {
  return req('/accounts/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  return req(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteAccount(id: string): Promise<void> {
  return req(`/accounts/${id}`, { method: 'DELETE' })
}
export async function payCardMonth(id: string, body: { new_balance_used: number }): Promise<Account> {
  return req(`/accounts/${id}/pay-month`, { method: 'POST', body: JSON.stringify(body) })
}
export async function liquidateCard(id: string): Promise<Account> {
  return req(`/accounts/${id}/liquidate`, { method: 'POST' })
}

// ── Recurring Expenses ───────────────────────────────────────────────────────

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  return req('/recurring-expenses/')
}
export async function createRecurringExpense(data: Omit<RecurringExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<RecurringExpense> {
  return req('/recurring-expenses/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateRecurringExpense(id: string, data: Partial<RecurringExpense>): Promise<RecurringExpense> {
  return req(`/recurring-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteRecurringExpense(id: string): Promise<void> {
  return req(`/recurring-expenses/${id}`, { method: 'DELETE' })
}

// ── Installment Purchases ────────────────────────────────────────────────────

export async function getInstallmentPurchases(): Promise<InstallmentPurchase[]> {
  return req('/installment-purchases/')
}
export async function createInstallmentPurchase(data: Omit<InstallmentPurchase, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'paid_month' | 'paid_year'> & { is_new_charge?: boolean }): Promise<InstallmentPurchase> {
  return req('/installment-purchases/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateInstallmentPurchase(id: string, data: Partial<InstallmentPurchase>): Promise<InstallmentPurchase> {
  return req(`/installment-purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteInstallmentPurchase(id: string): Promise<void> {
  return req(`/installment-purchases/${id}`, { method: 'DELETE' })
}
export async function markMsiPaid(id: string): Promise<InstallmentPurchase> {
  return req(`/installment-purchases/${id}/mark-paid`, { method: 'POST' })
}
export async function liquidateMsi(id: string): Promise<InstallmentPurchase> {
  return req(`/installment-purchases/${id}/liquidate`, { method: 'POST' })
}

// ── Savings Goals ─────────────────────────────────────────────────────────────

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  return req('/savings-goals/')
}
export async function createSavingsGoal(data: Omit<SavingsGoal, 'id' | 'user_id' | 'estimated_completion_date' | 'created_at' | 'updated_at' | 'contributed_month' | 'contributed_year' | 'last_contribution_amount'>): Promise<SavingsGoal> {
  return req('/savings-goals/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateSavingsGoal(id: string, data: Partial<SavingsGoal>): Promise<SavingsGoal> {
  return req(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteSavingsGoal(id: string): Promise<void> {
  return req(`/savings-goals/${id}`, { method: 'DELETE' })
}
export async function contributeGoal(id: string, amount: number): Promise<SavingsGoal> {
  return req(`/savings-goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) })
}

// ── Monthly Income ────────────────────────────────────────────────────────────

export async function getMonthlyIncome(): Promise<MonthlyIncome> {
  return req('/monthly-income/')
}
export async function setMonthlyIncome(amount: number, cycle_start_day = 1, account_id?: string | null): Promise<MonthlyIncome> {
  return req('/monthly-income/', { method: 'PUT', body: JSON.stringify({ amount, cycle_start_day, account_id: account_id || null }) })
}

// ── Projection ────────────────────────────────────────────────────────────────

export async function getProjection(months = 12): Promise<ProjectionResponse> {
  return req(`/projection/?months=${months}`)
}
export async function simulateProjection(data: {
  name: string
  total_amount: number
  monthly_amount: number
  total_installments: number
  start_date: string
}, months = 12): Promise<SimulationResponse> {
  return req(`/projection/simulate/?months=${months}`, { method: 'POST', body: JSON.stringify(data) })
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  return req('/expenses/')
}
export async function createExpense(data: {
  account_id?: string
  name: string
  amount: number
  date: string
  payment_method: 'cash' | 'debit' | 'credit' | 'savings'
  category?: string
}): Promise<Expense> {
  return req('/expenses/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateExpense(id: string, data: {
  account_id?: string
  name?: string
  amount?: number
  date?: string
  payment_method?: 'cash' | 'debit' | 'credit' | 'savings'
  category?: string | null
}): Promise<Expense> {
  return req(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteExpense(id: string): Promise<void> {
  return req(`/expenses/${id}`, { method: 'DELETE' })
}

// ── Credit Payments ───────────────────────────────────────────────────────────

export async function getCreditPayments(): Promise<CreditPayment[]> {
  return req('/credit-payments/')
}
export async function createCreditPayment(data: {
  account_id: string
  amount_paid: number
  payment_date: string
  statement_month: number
  statement_year: number
}): Promise<CreditPayment> {
  return req('/credit-payments/', { method: 'POST', body: JSON.stringify(data) })
}

// ── Incomes ───────────────────────────────────────────────────────────────────

export async function getIncomes(): Promise<Income[]> {
  return req('/incomes/')
}
export async function createIncome(data: {
  description: string
  amount: number
  date: string
  category?: string
  account_id?: string | null
}): Promise<Income> {
  return req('/incomes/', { method: 'POST', body: JSON.stringify(data) })
}
export async function deleteIncome(id: string): Promise<void> {
  return req(`/incomes/${id}`, { method: 'DELETE' })
}

// ── Push Notifications ────────────────────────────────────────────────────────

export async function getPushVapidKey(): Promise<string> {
  const res = await req<{ public_key: string }>('/push/vapid-public-key')
  return res.public_key
}
export async function registerPushSubscription(data: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  return req('/push/subscribe', { method: 'POST', body: JSON.stringify(data) })
}
export async function removePushSubscription(data: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  return req('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify(data) })
}
export async function testPushNotification(): Promise<{ total: number; delivered: number; dead_removed: number; detail: { endpoint_tail: string; delivered: boolean }[] }> {
  return req('/push/test', { method: 'POST' })
}
export async function debugPushSubscriptions(): Promise<{ subscription_count: number; vapid_private_configured: boolean; vapid_public_configured: boolean; vapid_public_key_tail: string | null; vapid_contact: string; subscriptions: { id: string; endpoint_tail: string; created_at: string }[] }> {
  return req('/push/debug')
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(params: { is_event?: boolean; label?: string; search?: string } = {}): Promise<Task[]> {
  const qs = new URLSearchParams()
  if (params.is_event !== undefined) qs.set('is_event', String(params.is_event))
  if (params.label) qs.set('label', params.label)
  if (params.search) qs.set('search', params.search)
  return req(`/tasks/?${qs}`)
}

export async function getTask(id: string): Promise<Task> {
  return req(`/tasks/${id}`)
}

export async function createTask(data: {
  title: string
  notes?: string | null
  label?: string | null
  is_event?: boolean
  due_date?: string | null
  due_time?: string | null
  location?: string | null
  is_starred?: boolean
  recurrence?: string | null
  reminder_at?: string | null
  remind_day_before?: boolean
}): Promise<Task> {
  return req('/tasks/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateTask(id: string, data: Partial<{
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
}>): Promise<Task> {
  return req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteTask(id: string): Promise<void> {
  return req(`/tasks/${id}`, { method: 'DELETE' })
}

export async function toggleTaskComplete(id: string): Promise<Task> {
  return req(`/tasks/${id}/complete`, { method: 'POST' })
}

export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  return req(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) })
}

export async function updateSubtask(taskId: string, subtaskId: string, data: { title?: string; is_completed?: boolean }): Promise<Subtask> {
  return req(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
  return req(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' })
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotes(params: { label?: string; search?: string } = {}): Promise<Note[]> {
  const qs = new URLSearchParams()
  if (params.label) qs.set('label', params.label)
  if (params.search) qs.set('search', params.search)
  return req(`/notes/?${qs}`)
}

export async function createNote(data: {
  title: string
  content?: string | null
  label?: string | null
  color?: string
  is_pinned?: boolean
}): Promise<Note> {
  return req('/notes/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateNote(id: string, data: Partial<{
  title: string
  content: string | null
  label: string | null
  color: string
  is_pinned: boolean
}>): Promise<Note> {
  return req(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteNote(id: string): Promise<void> {
  return req(`/notes/${id}`, { method: 'DELETE' })
}

export async function toggleNotePin(id: string): Promise<Note> {
  return req(`/notes/${id}/toggle-pin`, { method: 'POST' })
}

// ── Habits ────────────────────────────────────────────────────────────────────

export async function getHabits(weekStart: string): Promise<import('./types').Habit[]> {
  return req(`/habits/?week_start=${weekStart}`)
}

export async function createHabit(data: { name: string; color?: string }): Promise<import('./types').Habit> {
  return req('/habits/', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteHabit(id: string): Promise<void> {
  return req(`/habits/${id}`, { method: 'DELETE' })
}

export async function toggleHabitLog(id: string, date: string): Promise<void> {
  return req(`/habits/${id}/toggle`, { method: 'POST', body: JSON.stringify({ date }) })
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoriesResponse> {
  return req('/categories/')
}

export async function createCategory(name: string): Promise<CustomCategory> {
  return req('/categories/', { method: 'POST', body: JSON.stringify({ name }) })
}

export async function deleteCategory(id: string): Promise<void> {
  return req(`/categories/${id}`, { method: 'DELETE' })
}
