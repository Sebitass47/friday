import type {
  User, Account, RecurringExpense, InstallmentPurchase,
  SavingsGoal, MonthlyIncome, ProjectionResponse, SimulationResponse,
  Expense, CreditPayment, Income
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

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
export async function createAccount(data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Account> {
  return req('/accounts/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  return req(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteAccount(id: string): Promise<void> {
  return req(`/accounts/${id}`, { method: 'DELETE' })
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
export async function createInstallmentPurchase(data: Omit<InstallmentPurchase, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<InstallmentPurchase> {
  return req('/installment-purchases/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateInstallmentPurchase(id: string, data: Partial<InstallmentPurchase>): Promise<InstallmentPurchase> {
  return req(`/installment-purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteInstallmentPurchase(id: string): Promise<void> {
  return req(`/installment-purchases/${id}`, { method: 'DELETE' })
}

// ── Savings Goals ─────────────────────────────────────────────────────────────

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  return req('/savings-goals/')
}
export async function createSavingsGoal(data: Omit<SavingsGoal, 'id' | 'user_id' | 'estimated_completion_date' | 'created_at' | 'updated_at'>): Promise<SavingsGoal> {
  return req('/savings-goals/', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateSavingsGoal(id: string, data: Partial<SavingsGoal>): Promise<SavingsGoal> {
  return req(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteSavingsGoal(id: string): Promise<void> {
  return req(`/savings-goals/${id}`, { method: 'DELETE' })
}

// ── Monthly Income ────────────────────────────────────────────────────────────

export async function getMonthlyIncome(): Promise<MonthlyIncome> {
  return req('/monthly-income/')
}
export async function setMonthlyIncome(amount: number): Promise<MonthlyIncome> {
  return req('/monthly-income/', { method: 'PUT', body: JSON.stringify({ amount }) })
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
  account_id: string
  name: string
  amount: number
  date: string
  payment_method: 'cash' | 'debit' | 'credit'
  category?: string
}): Promise<Expense> {
  return req('/expenses/', { method: 'POST', body: JSON.stringify(data) })
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
}): Promise<Income> {
  return req('/incomes/', { method: 'POST', body: JSON.stringify(data) })
}
export async function deleteIncome(id: string): Promise<void> {
  return req(`/incomes/${id}`, { method: 'DELETE' })
}
