'use client'

import { useEffect, useState, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ProjectionChart from '@/components/charts/ProjectionChart'
import SpendingTimelineChart from '@/components/charts/SpendingTimelineChart'
import {
  getProjection, getInstallmentPurchases, getSavingsGoals, getMe,
  getRecurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
  createInstallmentPurchase, updateInstallmentPurchase, deleteInstallmentPurchase, liquidateMsi,
  createSavingsGoal, updateSavingsGoal, deleteSavingsGoal, contributeGoal,
  createExpense, createIncome, getAccounts, setMonthlyIncome, getMonthlyIncome,
  createAccount, updateAccount, deleteAccount, payCardMonth, liquidateCard,
  getExpenses,
} from '@/lib/api'
import type {
  ProjectionResponse, InstallmentPurchase, SavingsGoal,
  RecurringExpense, User, Account, Expense, MonthlyIncome,
} from '@/lib/types'
import {
  TrendingUp, TrendingDown, Minus, CreditCard, Target,
  RefreshCw, Plus, X, Pencil, Trash2, CheckCircle2, CalendarDays,
  Wallet, PiggyBank, Banknote, Zap,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { DateInput } from '@/components/ui/date-input'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const pct = (cur: number, tot: number) => Math.min(100, Math.round((cur / tot) * 100))
const today = () => new Date().toISOString().split('T')[0]

const ACCENT = 'text-[#6B46E5] dark:text-[#AF9BFF]'
const ACCENT_BG = 'bg-[#6B46E5] dark:bg-[#AF9BFF]'
const ACCENT_BG_SOFT = 'bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10'
const ACCENT_BORDER = 'border-[#6B46E5]/20 dark:border-[#AF9BFF]/20'
const CORAL = '#FF6B6B'

type ActiveModal = 'register' | 'msi' | 'goal' | 'recurring' | 'account' | 'edit-income' | null

const MSI_EMPTY = { name: '', total_amount: 0, monthly_amount: 0, total_installments: 12, remaining_installments: 12, start_date: today(), account_id: null as string | null, is_new_charge: true }
const GOAL_EMPTY = { name: '', target_amount: 0, current_amount: 0, monthly_contribution: 0 }
const REC_EMPTY = { name: '', amount: 0, frequency: 'monthly' as RecurringExpense['frequency'], interval_days: null as number | null }

interface AccountForm {
  name: string
  account_type: Account['account_type']
  balance: number
  currency: string
  is_active: boolean
  credit_limit: number | null
  current_balance_used: number | null
  closing_day: number | null
  payment_day: number | null
  id?: string
}
const ACCOUNT_EMPTY: AccountForm = {
  name: '', account_type: 'checking', balance: 0, currency: 'MXN', is_active: true,
  credit_limit: null, current_balance_used: null, closing_day: null, payment_day: null,
}

function inputCls() {
  return 'w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#6B46E5] dark:focus:border-[#AF9BFF] transition-colors'
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#141414] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-black/50 dark:text-white/40 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function FormActions({ onCancel, onSave, saving, saveLabel = 'Guardar', error }: {
  onCancel: () => void; onSave: () => void; saving: boolean; saveLabel?: string; error?: string
}) {
  return (
    <>
      {error && <p className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Cancelar</button>
        <button onClick={onSave} disabled={saving} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${ACCENT_BG} text-white disabled:opacity-50 hover:opacity-90`}>
          {saving ? 'Guardando…' : saveLabel}
        </button>
      </div>
    </>
  )
}

function usagePct(used: number, limit: number) {
  return limit > 0 ? used / limit : 0
}
function usageTextColor(pct: number) {
  if (pct >= 0.66) return 'text-red-400'
  if (pct >= 0.33) return 'text-amber-400'
  return 'text-[#6B46E5] dark:text-[#AF9BFF]'
}
function usageBgColor(pct: number) {
  if (pct >= 0.66) return 'bg-red-400'
  if (pct >= 0.33) return 'bg-amber-400'
  return 'bg-[#6B46E5] dark:bg-[#AF9BFF]'
}

function CreditUsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = usagePct(used, limit)
  const p = Math.min(100, Math.round(pct * 100))
  const color = usageBgColor(pct)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-black/40 dark:text-white/40">
        <span>{fmt(used)} usado · {fmt(limit - used)} disp.</span>
        <span>{p}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/[0.08]">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [msi, setMsi] = useState<InstallmentPurchase[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [monthlyIncomeData, setMonthlyIncomeData] = useState<MonthlyIncome | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // MSI form
  const [msiForm, setMsiForm] = useState<typeof MSI_EMPTY & { id?: string }>(MSI_EMPTY)
  const [msiSaving, setMsiSaving] = useState(false)
  const [msiError, setMsiError] = useState('')

  // Goal form
  const [goalForm, setGoalForm] = useState<typeof GOAL_EMPTY & { id?: string }>(GOAL_EMPTY)
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState('')

  // Contribute to goal modal
  interface ContributeState { goal: SavingsGoal; amount: number }
  const [contributeState, setContributeState] = useState<ContributeState | null>(null)
  const [contributeSaving, setContributeSaving] = useState(false)
  const [contributeError, setContributeError] = useState('')

  // Recurring form
  const [recForm, setRecForm] = useState<typeof REC_EMPTY & { id?: string }>(REC_EMPTY)
  const [recSaving, setRecSaving] = useState(false)
  const [recError, setRecError] = useState('')

  // Account form
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_EMPTY)
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountError, setAccountError] = useState('')

  // Pay card modal
  interface PayCardState { card: Account; amountToPay: number; newBalanceUsed: number }
  const [payCardState, setPayCardState] = useState<PayCardState | null>(null)
  const [payCardSaving, setPayCardSaving] = useState(false)
  const [payCardError, setPayCardError] = useState('')

  // Register (quick transaction)
  const [regMode, setRegMode] = useState<'expense' | 'income'>('expense')
  const [regAmount, setRegAmount] = useState('')
  const [regDesc, setRegDesc] = useState('')
  const [regMethod, setRegMethod] = useState<'cash' | 'debit' | 'credit'>('cash')
  const [regAccountId, setRegAccountId] = useState('')
  const [regCategory, setRegCategory] = useState('')
  const [regIsMonthly, setRegIsMonthly] = useState(false)
  const [regCycleStartDay, setRegCycleStartDay] = useState(1)
  const [regSaving, setRegSaving] = useState(false)
  const [regError, setRegError] = useState('')

  // Edit monthly income modal
  const [editIncomeAmount, setEditIncomeAmount] = useState('')
  const [editCycleStartDay, setEditCycleStartDay] = useState(1)
  const [editIncomeSaving, setEditIncomeSaving] = useState(false)
  const [editIncomeError, setEditIncomeError] = useState('')

  async function loadAll() {
    const [u, p, m, g, r, a, ex, inc] = await Promise.all([
      getMe(), getProjection(12), getInstallmentPurchases(), getSavingsGoals(), getRecurringExpenses(), getAccounts(), getExpenses(),
      getMonthlyIncome().catch(() => null),
    ])
    setUser(u); setProjection(p); setMsi(m); setGoals(g); setRecurring(r); setAccounts(a); setExpenses(ex)
    setMonthlyIncomeData(inc)
  }

  const autoOpenedRef = useRef(false)

  useEffect(() => {
    loadAll().catch(console.error).finally(() => setLoading(false))
  }, [])

  // Auto-open register modal when navigated with ?new=1
  useEffect(() => {
    if (loading || autoOpenedRef.current) return
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      autoOpenedRef.current = true
      openRegister()
    }
  }, [loading])

  function openRegister() {
    setRegAmount(''); setRegDesc(''); setRegMethod('cash'); setRegAccountId(''); setRegCategory('')
    setRegIsMonthly(false)
    setRegCycleStartDay(monthlyIncomeData?.cycle_start_day ?? 1)
    setRegError('')
    setActiveModal('register')
  }

  async function handleRegister() {
    if (!regAmount || !regDesc) { setRegError('Completa monto y descripción'); return }
    setRegSaving(true); setRegError('')
    try {
      if (regMode === 'expense') {
        await createExpense({ account_id: regAccountId || undefined, name: regDesc, amount: parseFloat(regAmount), date: today(), payment_method: regMethod, category: regCategory || undefined })
      } else {
        await createIncome({ description: regDesc, amount: parseFloat(regAmount), date: today(), category: regCategory || undefined })
        if (regIsMonthly) await setMonthlyIncome(parseFloat(regAmount), regCycleStartDay)
      }
      setActiveModal(null)
      const [p, a, ex] = await Promise.all([getProjection(12), getAccounts(), getExpenses()])
      setProjection(p); setAccounts(a); setExpenses(ex)
    } catch { setRegError('Error al guardar') }
    finally { setRegSaving(false) }
  }

  // Edit monthly income
  function openEditIncome() {
    setEditIncomeAmount(String(monthlyIncomeData?.amount ?? ''))
    setEditCycleStartDay(monthlyIncomeData?.cycle_start_day ?? 1)
    setEditIncomeError('')
    setActiveModal('edit-income')
  }
  async function handleEditIncome() {
    const amount = parseFloat(editIncomeAmount)
    if (!editIncomeAmount || isNaN(amount) || amount <= 0) { setEditIncomeError('Ingresa un monto válido'); return }
    setEditIncomeSaving(true); setEditIncomeError('')
    try {
      const updated = await setMonthlyIncome(amount, editCycleStartDay)
      setMonthlyIncomeData(updated)
      setActiveModal(null)
      const p = await getProjection(12)
      setProjection(p)
    } catch { setEditIncomeError('Error al guardar') }
    finally { setEditIncomeSaving(false) }
  }

  // MSI CRUD
  function openNewMsi() { setMsiForm({ ...MSI_EMPTY, start_date: today() }); setMsiError(''); setActiveModal('msi') }
  function openEditMsi(item: InstallmentPurchase) {
    setMsiForm({ name: item.name, total_amount: Number(item.total_amount), monthly_amount: Number(item.monthly_amount), total_installments: item.total_installments, remaining_installments: item.remaining_installments, start_date: item.start_date, account_id: item.account_id, is_new_charge: false, id: item.id })
    setMsiError(''); setActiveModal('msi')
  }
  async function saveMsi() {
    if (!msiForm.name.trim()) { setMsiError('El nombre es requerido'); return }
    if (msiForm.monthly_amount <= 0) { setMsiError('El pago mensual debe ser mayor a 0'); return }
    setMsiSaving(true); setMsiError('')
    try {
      if (msiForm.id) await updateInstallmentPurchase(msiForm.id, msiForm)
      else await createInstallmentPurchase(msiForm)
      const [m, a] = await Promise.all([getInstallmentPurchases(), getAccounts()])
      setMsi(m); setAccounts(a); setActiveModal(null)
    } catch (e: unknown) { setMsiError(e instanceof Error ? e.message : 'Error') }
    finally { setMsiSaving(false) }
  }
  async function deleteMsi(id: string) {
    if (!confirm('¿Eliminar este MSI?')) return
    await deleteInstallmentPurchase(id)
    setMsi(prev => prev.filter(i => i.id !== id))
  }
  async function handleLiquidateMsi(id: string, name: string) {
    if (!confirm(`¿Liquidar "${name}"? Se pagará el saldo restante y se liberará el crédito de tu tarjeta.`)) return
    try {
      const updated = await liquidateMsi(id)
      setMsi(prev => prev.map(i => i.id === id ? updated : i))
      const a = await getAccounts(); setAccounts(a)
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error') }
  }

  // Goal CRUD
  function openNewGoal() { setGoalForm(GOAL_EMPTY); setGoalError(''); setActiveModal('goal') }
  function openEditGoal(g: SavingsGoal) {
    setGoalForm({ name: g.name, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount), monthly_contribution: Number(g.monthly_contribution), id: g.id })
    setGoalError(''); setActiveModal('goal')
  }
  async function saveGoal() {
    if (!goalForm.name.trim()) { setGoalError('El nombre es requerido'); return }
    if (goalForm.target_amount <= 0) { setGoalError('La meta debe ser mayor a 0'); return }
    setGoalSaving(true); setGoalError('')
    try {
      if (goalForm.id) await updateSavingsGoal(goalForm.id, goalForm)
      else await createSavingsGoal(goalForm)
      setGoals(await getSavingsGoals()); setActiveModal(null)
    } catch (e: unknown) { setGoalError(e instanceof Error ? e.message : 'Error') }
    finally { setGoalSaving(false) }
  }
  async function deleteGoal(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    await deleteSavingsGoal(id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }
  function openContributeGoal(g: SavingsGoal) {
    setContributeState({ goal: g, amount: Number(g.monthly_contribution) })
    setContributeError('')
  }
  async function handleContribute() {
    if (!contributeState) return
    if (contributeState.amount <= 0) { setContributeError('El monto debe ser mayor a 0'); return }
    setContributeSaving(true); setContributeError('')
    try {
      const updated = await contributeGoal(contributeState.goal.id, contributeState.amount)
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
      setContributeState(null)
      // Refresh projection since savings now count this month
      getProjection(12).then(p => setProjection(p))
    } catch (e: unknown) { setContributeError(e instanceof Error ? e.message : 'Error') }
    finally { setContributeSaving(false) }
  }

  // Recurring CRUD
  function openNewRec() { setRecForm(REC_EMPTY); setRecError(''); setActiveModal('recurring') }
  function openEditRec(e: RecurringExpense) {
    setRecForm({ name: e.name, amount: Number(e.amount), frequency: e.frequency, interval_days: e.interval_days, id: e.id })
    setRecError(''); setActiveModal('recurring')
  }
  async function saveRec() {
    if (!recForm.name.trim()) { setRecError('El nombre es requerido'); return }
    if (recForm.amount <= 0) { setRecError('El monto debe ser mayor a 0'); return }
    setRecSaving(true); setRecError('')
    try {
      if (recForm.id) await updateRecurringExpense(recForm.id, recForm)
      else await createRecurringExpense(recForm)
      setRecurring(await getRecurringExpenses()); setActiveModal(null)
    } catch (e: unknown) { setRecError(e instanceof Error ? e.message : 'Error') }
    finally { setRecSaving(false) }
  }
  async function deleteRec(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await deleteRecurringExpense(id)
    setRecurring(prev => prev.filter(e => e.id !== id))
  }

  // Account CRUD
  function openNewAccount() { setAccountForm(ACCOUNT_EMPTY); setAccountError(''); setActiveModal('account') }
  function openEditAccount(a: Account) {
    setAccountForm({
      name: a.name, account_type: a.account_type, balance: Number(a.balance),
      currency: a.currency, is_active: a.is_active,
      credit_limit: a.credit_limit ? Number(a.credit_limit) : null,
      current_balance_used: a.current_balance_used ? Number(a.current_balance_used) : null,
      closing_day: a.closing_day, payment_day: a.payment_day, id: a.id,
    })
    setAccountError(''); setActiveModal('account')
  }
  async function saveAccount() {
    if (!accountForm.name.trim()) { setAccountError('El nombre es requerido'); return }
    setAccountSaving(true); setAccountError('')
    try {
      const { id, ...payload } = accountForm
      if (id) await updateAccount(id, payload)
      else await createAccount(payload)
      setAccounts(await getAccounts()); setActiveModal(null)
    } catch (e: unknown) { setAccountError(e instanceof Error ? e.message : 'Error') }
    finally { setAccountSaving(false) }
  }
  async function removeAccount(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await deleteAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }
  function openPayCardModal(card: Account) {
    const linkedMsis = msi.filter(m => m.account_id === card.id && m.remaining_installments > 0)
    const computedPayment = linkedMsis.reduce((sum, m) => sum + Number(m.monthly_amount), 0)
    const currentUsed = Number(card.current_balance_used) || 0
    const newBalance = Math.max(0, currentUsed - computedPayment)
    setPayCardState({ card, amountToPay: computedPayment, newBalanceUsed: newBalance })
    setPayCardError('')
  }
  async function handleConfirmPayCard() {
    if (!payCardState) return
    setPayCardSaving(true); setPayCardError('')
    try {
      const updated = await payCardMonth(payCardState.card.id, { new_balance_used: payCardState.newBalanceUsed })
      setAccounts(prev => prev.map(a => a.id === payCardState.card.id ? updated : a))
      setMsi(await getInstallmentPurchases())
      setPayCardState(null)
    } catch (e: unknown) { setPayCardError(e instanceof Error ? e.message : 'Error') }
    finally { setPayCardSaving(false) }
  }
  async function handleLiquidateCard(id: string, name: string) {
    if (!confirm(`¿Liquidar la tarjeta "${name}"? Se saldarán todos los MSI vinculados y el saldo quedará en $0.`)) return
    try {
      const updated = await liquidateCard(id)
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
      setMsi(await getInstallmentPurchases())
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error') }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B46E5]/30 dark:border-[#AF9BFF]/30 border-t-[#6B46E5] dark:border-t-[#AF9BFF]" />
        </div>
      </AppLayout>
    )
  }

  const thisMonth = projection?.months[0]
  const totalExpenses = thisMonth
    ? Number(thisMonth.recurring_expenses) + Number(thisMonth.installments) + Number(thisMonth.savings_contributions)
    : 0
  const available = thisMonth?.available ?? 0
  const isNeg = available < 0
  const activeMsi = msi.filter(m => m.remaining_installments > 0)
  const totalRecurring = recurring.reduce((s, e) => s + Number(e.amount), 0)

  const creditCards = accounts.filter(a => a.account_type === 'credit_card')
  const otherAccounts = accounts.filter(a => a.account_type !== 'credit_card')
  const totalUsed = creditCards.reduce((s, a) => s + (Number(a.current_balance_used) || 0), 0)
  const totalCreditAvail = creditCards.reduce((s, a) => s + (Number(a.available_credit) || 0), 0)
  const totalCreditLimit = creditCards.reduce((s, a) => s + (Number(a.credit_limit) || 0), 0)
  const debtColor = usageTextColor(usagePct(totalUsed, totalCreditLimit))

  const cardCls = 'bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.14] dark:hover:border-white/[0.14] transition-all shadow-sm'

  // Billing month helper for register modal
  function getBillingMonth(card: Account): string {
    if (!card.closing_day) return ''
    const d = new Date()
    let m = d.getMonth(), y = d.getFullYear()
    if (d.getDate() > card.closing_day) { m++; if (m > 11) { m = 0; y++ } }
    return new Date(y, m, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  }
  const selectedRegCard = accounts.find(a => a.id === regAccountId)
  const billingMonth = regMethod === 'credit' && selectedRegCard?.account_type === 'credit_card'
    ? getBillingMonth(selectedRegCard) : ''

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-black/40 dark:text-white/40 capitalize">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-2xl font-bold text-black dark:text-white mt-0.5">
              Buenos días{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openRegister}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 ${ACCENT_BG}`}
            >
              <Plus size={15} strokeWidth={2.5} />
              Registrar
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${cardCls} p-6`}>
            <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">Disponible este mes</p>
            <p className={`text-4xl font-bold tabular-nums ${isNeg ? '' : 'text-black dark:text-white'}`} style={isNeg ? { color: CORAL } : {}}>
              {fmt(available)}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {isNeg
                ? <TrendingDown size={13} style={{ color: CORAL }} />
                : available < (thisMonth?.income ?? 0) * 0.2
                ? <Minus size={13} className="text-amber-500 dark:text-amber-400" />
                : <TrendingUp size={13} className="text-emerald-500 dark:text-emerald-400" />
              }
              <span className="text-xs text-black/40 dark:text-white/40">
                {isNeg ? 'Déficit este mes' : 'Después de compromisos'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className={`${cardCls} p-5 flex-1`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                  <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest">Ingreso mensual</p>
                </div>
                <button onClick={openEditIncome} className="p-1 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <Pencil size={13} />
                </button>
              </div>
              <p className="text-2xl font-semibold text-black dark:text-white tabular-nums">{fmt(monthlyIncomeData?.amount ?? thisMonth?.income ?? 0)}</p>
              {monthlyIncomeData && (
                <p className="text-[10px] text-black/30 dark:text-white/30 mt-1">Ciclo desde el día {monthlyIncomeData.cycle_start_day}</p>
              )}
            </div>
            <div className={`${cardCls} p-5 flex-1`}>
              <div className="flex items-center gap-2 mb-1">
                <X size={14} style={{ color: CORAL }} />
                <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest">Total compromisos</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: CORAL }}>{fmt(totalExpenses)}</p>
            </div>
          </div>
        </div>

        {/* Spending timeline */}
        <div className={`${cardCls} p-5`}>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-black dark:text-white">Gastos del mes</h2>
            <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Balance real · cada punto es un día con gastos</p>
          </div>
          <SpendingTimelineChart
            expenses={expenses}
            monthlyIncome={monthlyIncomeData?.amount ?? Number(projection?.months[0]?.income ?? 0)}
            cycleStartDay={monthlyIncomeData?.cycle_start_day ?? 1}
          />
        </div>

        {/* Chart */}
        <div className={`${cardCls} p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-black dark:text-white">Proyección · 12 meses</h2>
              <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Dinero disponible mes a mes</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-black/40 dark:text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#6B46E5]/70 dark:bg-[#AF9BFF]/70" />Positivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: `${CORAL}b3` }} />Déficit
              </span>
            </div>
          </div>
          {projection && <ProjectionChart months={projection.months} />}
        </div>

        {/* Accounts section */}
        {accounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest">Cuentas y tarjetas</h2>
              <button onClick={openNewAccount} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${ACCENT_BG_SOFT} ${ACCENT} transition-opacity hover:opacity-80`}>
                <Plus size={12} strokeWidth={2.5} /> Nueva
              </button>
            </div>

            {/* Summary row */}
            {creditCards.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className={`${cardCls} p-4`}>
                  <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Total activos</p>
                  <p className="text-base font-semibold text-black dark:text-white tabular-nums">{fmt(otherAccounts.reduce((s, a) => s + Number(a.balance), 0))}</p>
                </div>
                <div className={`${cardCls} p-4`}>
                  <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Deuda tarjetas</p>
                  <p className={`text-base font-semibold tabular-nums ${debtColor}`}>{fmt(totalUsed)}</p>
                </div>
                <div className={`${cardCls} p-4`}>
                  <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Crédito disp.</p>
                  <p className="text-base font-semibold text-emerald-400 tabular-nums">{fmt(totalCreditAvail)}</p>
                </div>
              </div>
            )}

            {/* Credit cards */}
            {creditCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {creditCards.map(a => {
                  const used = Number(a.current_balance_used) || 0
                  const limit = Number(a.credit_limit) || 0
                  const cardUsedColor = usageTextColor(usagePct(used, limit))
                  return (
                    <div key={a.id} className={`${cardCls} p-5 space-y-3 hover:border-amber-400/30`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-amber-400/10 p-2">
                            <CreditCard size={16} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-black dark:text-white">{a.name}</p>
                            <p className="text-[11px] text-black/40 dark:text-white/40">Tarjeta de crédito</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditAccount(a)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"><Pencil size={12} /></button>
                          <button onClick={() => removeAccount(a.id)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-2.5">
                          <p className="text-[9px] text-black/40 dark:text-white/40 mb-0.5">Usado</p>
                          <p className={`text-xs font-semibold tabular-nums ${cardUsedColor}`}>{fmt(used)}</p>
                        </div>
                        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-2.5">
                          <p className="text-[9px] text-black/40 dark:text-white/40 mb-0.5">Disponible</p>
                          <p className="text-xs font-semibold text-emerald-400 tabular-nums">{limit > 0 ? fmt(limit - used) : '—'}</p>
                        </div>
                        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-2.5">
                          <p className="text-[9px] text-black/40 dark:text-white/40 mb-0.5">Límite</p>
                          <p className="text-xs font-semibold text-black dark:text-white tabular-nums">{limit > 0 ? fmt(limit) : '—'}</p>
                        </div>
                      </div>
                      {limit > 0 && <CreditUsageBar used={used} limit={limit} />}
                      {(a.closing_day || a.payment_day) && (
                        <div className="flex items-center gap-3 pt-1 border-t border-black/[0.05] dark:border-white/[0.05] text-[11px]">
                          {a.closing_day && <span className="text-black/40 dark:text-white/40">Corte: <span className="font-medium text-black dark:text-white">día {a.closing_day}</span></span>}
                          {a.closing_day && a.payment_day && <span className="text-black/20 dark:text-white/20">·</span>}
                          {a.payment_day && <span className="text-black/40 dark:text-white/40">Pago: <span className="font-medium text-[#6B46E5] dark:text-[#AF9BFF]">día {a.payment_day}</span></span>}
                        </div>
                      )}
                      {/* Card actions */}
                      <div className="flex gap-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
                        <button
                          onClick={() => openPayCardModal(a)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10 text-[#6B46E5] dark:text-[#AF9BFF] text-xs font-medium hover:opacity-80 transition-opacity"
                        >
                          <Banknote size={13} /> Pagar este mes
                        </button>
                        <button
                          onClick={() => handleLiquidateCard(a.id, a.name)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-400/10 text-amber-500 dark:text-amber-400 text-xs font-medium hover:opacity-80 transition-opacity"
                        >
                          <Zap size={13} /> Liquidar tarjeta
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Other accounts */}
            {otherAccounts.length > 0 && (
              <div className="space-y-2">
                {otherAccounts.map(a => (
                  <div key={a.id} className={`${cardCls} flex items-center justify-between px-5 py-3.5`}>
                    <div className="flex items-center gap-3">
                      <div className={`${a.account_type === 'savings' ? 'text-emerald-400' : 'text-[#6B46E5] dark:text-[#AF9BFF]'}`}>
                        {a.account_type === 'savings' ? <PiggyBank size={16} /> : <Wallet size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black dark:text-white">{a.name}</p>
                        <p className="text-[11px] text-black/40 dark:text-white/40">{a.account_type === 'savings' ? 'Ahorro' : 'Débito'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-semibold tabular-nums ${a.account_type === 'savings' ? 'text-emerald-400' : 'text-black dark:text-white'}`}>{fmt(Number(a.balance))}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditAccount(a)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"><Pencil size={12} /></button>
                        <button onClick={() => removeAccount(a.id)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add first account prompt */}
        {accounts.length === 0 && (
          <button onClick={openNewAccount} className={`w-full ${cardCls} p-5 flex items-center justify-center gap-3 text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white border-dashed`}>
            <Plus size={16} />
            Agrega tu primera cuenta o tarjeta
          </button>
        )}

        {/* Bottom 3 sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* MSI activos */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={15} className={ACCENT} />
              <h2 className="text-sm font-semibold text-black dark:text-white">MSI activos</h2>
              <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ACCENT_BG_SOFT} ${ACCENT}`}>{activeMsi.length}</span>
              <button onClick={openNewMsi} className={`ml-auto p-1 rounded-lg ${ACCENT_BG_SOFT} ${ACCENT} hover:opacity-80 transition-opacity`}>
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
            {activeMsi.length === 0 ? (
              <p className="text-xs text-black/30 dark:text-white/30 py-4 text-center">Sin MSI activos</p>
            ) : (
              <div className="space-y-3">
                {activeMsi.slice(0, 5).map(item => {
                  const paid = item.total_installments - item.remaining_installments
                  const progress = pct(paid, item.total_installments)
                  const now = new Date()
                  const paidThisMonth = item.paid_month === (now.getMonth() + 1) && item.paid_year === now.getFullYear()
                  const linkedCard = accounts.find(a => a.id === item.account_id)
                  return (
                    <div key={item.id} className="group space-y-1.5 pb-3 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-black dark:text-white truncate block">{item.name}</span>
                          {linkedCard && <span className="text-[10px] text-black/35 dark:text-white/35">{linkedCard.name}</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-xs text-black/40 dark:text-white/40 tabular-nums">{fmt(Number(item.monthly_amount))}/mes</span>
                          <button onClick={() => openEditMsi(item)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-all"><Pencil size={11} /></button>
                          <button onClick={() => deleteMsi(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-[#FF6B6B] transition-all"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                        <div className="h-1 rounded-full bg-[#6B46E5]/60 dark:bg-[#AF9BFF]/60" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-black/25 dark:text-white/25">{paid} de {item.total_installments} meses</p>
                        <div className="flex items-center gap-1.5">
                          {paidThisMonth && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={10} /> Pagado este mes
                            </span>
                          )}
                          <button
                            onClick={() => handleLiquidateMsi(item.id, item.name)}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-500 dark:text-amber-400 font-medium hover:opacity-80 transition-opacity"
                          >
                            Liquidar
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {activeMsi.length > 5 && (
                  <p className="text-xs text-black/30 dark:text-white/30 text-center pt-1">+{activeMsi.length - 5} más</p>
                )}
              </div>
            )}
          </div>

          {/* Metas de ahorro */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Target size={15} className="text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-black dark:text-white">Metas de ahorro</h2>
              <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">{goals.length}</span>
              <button onClick={openNewGoal} className="ml-auto p-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition-opacity">
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-black/30 dark:text-white/30 py-4 text-center">Sin metas configuradas</p>
            ) : (
              <div className="space-y-3.5">
                {goals.slice(0, 4).map(g => {
                  const progress = pct(Number(g.current_amount), Number(g.target_amount))
                  const today = new Date()
                  const contributedThisMonth = g.contributed_month === today.getMonth() + 1 && g.contributed_year === today.getFullYear()
                  const isComplete = Number(g.current_amount) >= Number(g.target_amount)
                  return (
                    <div key={g.id} className="group space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-black dark:text-white truncate max-w-[50%]">{g.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-black/60 dark:text-white/60 tabular-nums">{progress}%</span>
                          <button onClick={() => openEditGoal(g)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-all"><Pencil size={11} /></button>
                          <button onClick={() => deleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-[#FF6B6B] transition-all"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                        <div className="h-1 rounded-full bg-emerald-500/60 dark:bg-emerald-400/70" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-black/25 dark:text-white/25">{fmt(Number(g.current_amount))} de {fmt(Number(g.target_amount))}</p>
                        {g.estimated_completion_date && (
                          <div className="flex items-center gap-0.5 text-[10px] text-black/25 dark:text-white/25">
                            <CalendarDays size={9} />
                            <span>{new Date(g.estimated_completion_date + 'T00:00:00').toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>
                      {!isComplete && (
                        contributedThisMonth ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={10} />
                            Aportado: {fmt(Number(g.last_contribution_amount))} este mes
                          </div>
                        ) : (
                          <button
                            onClick={() => openContributeGoal(g)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium hover:opacity-80 transition-opacity"
                          >
                            + Ahorré este mes
                          </button>
                        )
                      )}
                    </div>
                  )
                })}
                {goals.length > 4 && (
                  <p className="text-xs text-black/30 dark:text-white/30 text-center pt-1">+{goals.length - 4} más</p>
                )}
              </div>
            )}
          </div>

          {/* Recurrentes */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw size={15} style={{ color: CORAL }} />
              <h2 className="text-sm font-semibold text-black dark:text-white">Recurrentes</h2>
              <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#FF6B6B]/10 text-[#FF6B6B]">{recurring.length}</span>
              <button onClick={openNewRec} className="ml-auto p-1 rounded-lg bg-[#FF6B6B]/10 text-[#FF6B6B] hover:opacity-80 transition-opacity">
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
            {recurring.length === 0 ? (
              <p className="text-xs text-black/30 dark:text-white/30 py-4 text-center">Sin gastos recurrentes</p>
            ) : (
              <>
                <div className="space-y-2">
                  {recurring.slice(0, 5).map(e => (
                    <div key={e.id} className="group flex items-center justify-between">
                      <span className="text-xs text-black dark:text-white truncate max-w-[55%]">{e.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-black/70 dark:text-white/70 tabular-nums">{fmt(Number(e.amount))}</span>
                        <button onClick={() => openEditRec(e)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-all"><Pencil size={11} /></button>
                        <button onClick={() => deleteRec(e.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-[#FF6B6B] transition-all"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                  {recurring.length > 5 && (
                    <p className="text-xs text-black/30 dark:text-white/30 text-center pt-1">+{recurring.length - 5} más</p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wide">Mensual</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: CORAL }}>{fmt(totalRecurring)}</span>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Modals ── */}

      {/* Quick Register */}
      {activeModal === 'register' && (
        <Modal title="Registrar" subtitle={`Captura rápida · ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`} onClose={() => setActiveModal(null)}>
          <div className="flex rounded-xl border border-black/10 dark:border-white/10 overflow-hidden p-0.5 bg-black/[0.03] dark:bg-white/[0.03]">
            {(['expense', 'income'] as const).map(m => (
              <button key={m} onClick={() => setRegMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${regMode === m ? `${ACCENT_BG} text-white` : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}>
                {m === 'expense' ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>

          <FormField label="Monto">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-black/40 dark:text-white/40">$</span>
              <input type="number" step="0.01" placeholder="0.00" value={regAmount} onChange={e => setRegAmount(e.target.value)} className={`${inputCls()} pl-7 text-xl font-bold`} />
            </div>
          </FormField>

          <FormField label="Descripción">
            <input placeholder="Ej. Súper de la semana" value={regDesc} onChange={e => setRegDesc(e.target.value)} className={inputCls()} />
          </FormField>

          {regMode === 'expense' && (
            <>
              <FormField label="Método de pago">
                <div className="flex gap-2">
                  {(['credit', 'cash', 'debit'] as const).map(m => (
                    <button key={m} onClick={() => setRegMethod(m)}
                      className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${regMethod === m ? `${ACCENT_BG_SOFT} ${ACCENT} ${ACCENT_BORDER}` : 'border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:border-black/20 dark:hover:border-white/20'}`}>
                      {m === 'credit' ? 'Tarjeta' : m === 'cash' ? 'Efectivo' : 'Transf.'}
                    </button>
                  ))}
                </div>
              </FormField>

              {regMethod !== 'cash' && accounts.length > 0 && (
                <FormField label={regMethod === 'credit' ? 'Tarjeta' : 'Cuenta'}>
                  <CustomSelect
                    value={regAccountId}
                    onChange={setRegAccountId}
                    placeholder="Selecciona"
                    options={[
                      { value: '', label: 'Sin cuenta' },
                      ...accounts
                        .filter(a => regMethod === 'credit' ? a.account_type === 'credit_card' : a.account_type !== 'credit_card')
                        .map(a => ({ value: a.id, label: a.name }))
                    ]}
                  />
                  {billingMonth && (
                    <p className="text-[11px] text-[#6B46E5] dark:text-[#AF9BFF] bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10 rounded-lg px-2.5 py-1.5 mt-1.5">
                      Se cobra en el estado de: <span className="font-semibold capitalize">{billingMonth}</span>
                    </p>
                  )}
                </FormField>
              )}
            </>
          )}

          <FormField label="Categoría (opcional)">
            <input placeholder="Alimentación, Transporte…" value={regCategory} onChange={e => setRegCategory(e.target.value)} className={inputCls()} />
          </FormField>

          {regMode === 'income' && (
            <div className="space-y-2">
              <button type="button" onClick={() => setRegIsMonthly(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${regIsMonthly ? `${ACCENT_BG_SOFT} ${ACCENT_BORDER} ${ACCENT}` : 'border-black/10 dark:border-white/10 text-black/50 dark:text-white/50'}`}>
                <span>¿Es tu ingreso mensual fijo?</span>
                <span className={`w-8 h-4 rounded-full transition-all flex items-center px-0.5 ${regIsMonthly ? 'bg-[#6B46E5] dark:bg-[#AF9BFF] justify-end' : 'bg-black/10 dark:bg-white/10 justify-start'}`}>
                  <span className="w-3 h-3 rounded-full bg-white" />
                </span>
              </button>
              {regIsMonthly && (
                <FormField label="Día de inicio de tu ciclo financiero (1–31)">
                  <input
                    type="number" min={1} max={31}
                    value={regCycleStartDay}
                    onChange={e => setRegCycleStartDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                    className={inputCls()}
                  />
                  <p className="text-[10px] text-black/30 dark:text-white/30 mt-1">
                    Todos los cálculos de ingreso y compromisos arrancan este día cada mes
                  </p>
                </FormField>
              )}
            </div>
          )}

          <FormActions onCancel={() => setActiveModal(null)} onSave={handleRegister} saving={regSaving} saveLabel={regMode === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'} error={regError} />
        </Modal>
      )}

      {/* Add/Edit MSI */}
      {activeModal === 'msi' && (
        <Modal title={msiForm.id ? 'Editar MSI' : 'Nuevo MSI'} onClose={() => setActiveModal(null)}>
          <FormField label="Descripción">
            <input value={msiForm.name} onChange={e => setMsiForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. MacBook 18 MSI" className={inputCls()} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Monto total">
              <input type="number" value={msiForm.total_amount} onChange={e => setMsiForm(f => ({ ...f, total_amount: Number(e.target.value) }))} className={inputCls()} />
            </FormField>
            <FormField label="Pago mensual">
              <input type="number" value={msiForm.monthly_amount} onChange={e => setMsiForm(f => ({ ...f, monthly_amount: Number(e.target.value) }))} className={inputCls()} />
            </FormField>
            <FormField label="Total cuotas">
              <input type="number" min={1} value={msiForm.total_installments} onChange={e => setMsiForm(f => ({ ...f, total_installments: Number(e.target.value) }))} className={inputCls()} />
            </FormField>
            <FormField label="Cuotas restantes">
              <input type="number" min={0} value={msiForm.remaining_installments} onChange={e => setMsiForm(f => ({ ...f, remaining_installments: Number(e.target.value) }))} className={inputCls()} />
            </FormField>
          </div>
          <FormField label="Fecha de inicio">
            <DateInput
              value={msiForm.start_date}
              onChange={v => setMsiForm(f => ({ ...f, start_date: v }))}
              inputClassName="bg-black/[0.03] dark:bg-white/[0.03] border-black/10 dark:border-white/10 rounded-xl py-2 text-sm text-black dark:text-white focus:border-[#6B46E5] dark:focus:border-[#AF9BFF]"
            />
          </FormField>

          {creditCards.length > 0 && (
            <FormField label="Tarjeta de crédito (opcional)">
              <CustomSelect
                value={msiForm.account_id ?? ''}
                onChange={v => setMsiForm(f => ({ ...f, account_id: v || null }))}
                options={[
                  { value: '', label: 'Sin tarjeta vinculada' },
                  ...creditCards.map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </FormField>
          )}

          {msiForm.account_id && !msiForm.id && (
            <button
              type="button"
              onClick={() => setMsiForm(f => ({ ...f, is_new_charge: !f.is_new_charge }))}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${msiForm.is_new_charge ? `${ACCENT_BG_SOFT} ${ACCENT_BORDER} ${ACCENT}` : 'border-black/10 dark:border-white/10 text-black/50 dark:text-white/50'}`}
            >
              <div className="text-left">
                <p className="text-xs font-medium">¿Es un cargo nuevo a la tarjeta?</p>
                <p className="text-[10px] opacity-60 mt-0.5">{msiForm.is_new_charge ? 'Se sumará al saldo usado de la tarjeta' : 'Ya está contemplado en el saldo inicial'}</p>
              </div>
              <span className={`w-8 h-4 rounded-full transition-all flex items-center px-0.5 shrink-0 ml-3 ${msiForm.is_new_charge ? 'bg-[#6B46E5] dark:bg-[#AF9BFF] justify-end' : 'bg-black/10 dark:bg-white/10 justify-start'}`}>
                <span className="w-3 h-3 rounded-full bg-white" />
              </span>
            </button>
          )}

          <FormActions onCancel={() => setActiveModal(null)} onSave={saveMsi} saving={msiSaving} error={msiError} />
        </Modal>
      )}

      {/* Add/Edit Goal */}
      {activeModal === 'goal' && (
        <Modal title={goalForm.id ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={() => setActiveModal(null)}>
          <FormField label="¿Para qué estás ahorrando?">
            <input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} placeholder="PC gaming, viaje, emergencias…" className={inputCls()} />
          </FormField>
          <FormField label="Meta total">
            <input type="number" value={goalForm.target_amount} onChange={e => setGoalForm(f => ({ ...f, target_amount: Number(e.target.value) }))} className={inputCls()} />
          </FormField>
          <FormField label="Ya ahorré">
            <input type="number" value={goalForm.current_amount} onChange={e => setGoalForm(f => ({ ...f, current_amount: Number(e.target.value) }))} className={inputCls()} />
          </FormField>
          <FormField label="Ahorro mensual">
            <input type="number" value={goalForm.monthly_contribution} onChange={e => setGoalForm(f => ({ ...f, monthly_contribution: Number(e.target.value) }))} className={inputCls()} />
          </FormField>
          {goalForm.monthly_contribution > 0 && goalForm.target_amount > goalForm.current_amount && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl px-3 py-2">
              Llegarás en ~{Math.ceil((goalForm.target_amount - goalForm.current_amount) / goalForm.monthly_contribution)} meses
            </p>
          )}
          <FormActions onCancel={() => setActiveModal(null)} onSave={saveGoal} saving={goalSaving} error={goalError} />
        </Modal>
      )}

      {/* Add/Edit Recurring */}
      {activeModal === 'recurring' && (
        <Modal title={recForm.id ? 'Editar gasto' : 'Nuevo gasto recurrente'} onClose={() => setActiveModal(null)}>
          <FormField label="Nombre">
            <input value={recForm.name} onChange={e => setRecForm(f => ({ ...f, name: e.target.value }))} placeholder="Renta, Netflix, Gym…" className={inputCls()} />
          </FormField>
          <FormField label="Monto">
            <input type="number" value={recForm.amount} onChange={e => setRecForm(f => ({ ...f, amount: Number(e.target.value) }))} className={inputCls()} />
          </FormField>
          <FormField label="Frecuencia">
            <CustomSelect
              value={recForm.frequency}
              onChange={v => setRecForm(f => ({ ...f, frequency: v as RecurringExpense['frequency'] }))}
              options={[
                { value: 'monthly', label: 'Mensual' },
                { value: 'weekly', label: 'Semanal' },
                { value: 'custom', label: 'Personalizado' },
              ]}
            />
          </FormField>
          {recForm.frequency === 'custom' && (
            <FormField label="Cada cuántos días">
              <input type="number" min={1} value={recForm.interval_days ?? ''} onChange={e => setRecForm(f => ({ ...f, interval_days: e.target.value ? Number(e.target.value) : null }))} className={inputCls()} />
            </FormField>
          )}
          <FormActions onCancel={() => setActiveModal(null)} onSave={saveRec} saving={recSaving} error={recError} />
        </Modal>
      )}

      {/* Edit monthly income */}
      {activeModal === 'edit-income' && (
        <Modal title="Ingreso y ciclo financiero" onClose={() => setActiveModal(null)}>
          <FormField label="Monto mensual">
            <input
              type="number" min={0} placeholder="30000"
              value={editIncomeAmount}
              onChange={e => setEditIncomeAmount(e.target.value)}
              className={inputCls()}
              autoFocus
            />
          </FormField>
          <FormField label="Día de inicio de tu ciclo financiero (1–31)">
            <input
              type="number" min={1} max={31}
              value={editCycleStartDay}
              onChange={e => setEditCycleStartDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
              className={inputCls()}
            />
            <p className="text-[10px] text-black/30 dark:text-white/30 mt-1">
              Todos los cálculos (ingreso, MSI, recurrentes, proyección) arrancan este día.
              Si pones 29–31 y el mes no tiene ese día, se usa el último día del mes.
            </p>
          </FormField>
          <FormActions onCancel={() => setActiveModal(null)} onSave={handleEditIncome} saving={editIncomeSaving} saveLabel="Guardar" error={editIncomeError} />
        </Modal>
      )}

      {/* Add/Edit Account */}
      {activeModal === 'account' && (
        <Modal title={accountForm.id ? 'Editar cuenta' : 'Nueva cuenta'} onClose={() => setActiveModal(null)}>
          <FormField label="Nombre">
            <input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Ej. BBVA Oro, Débito HSBC…" className={inputCls()} />
          </FormField>
          <FormField label="Tipo">
            <CustomSelect
              value={accountForm.account_type}
              onChange={v => setAccountForm({ ...accountForm, account_type: v as Account['account_type'] })}
              options={[
                { value: 'checking', label: 'Débito / Cheques' },
                { value: 'savings', label: 'Ahorro' },
                { value: 'credit_card', label: 'Tarjeta de crédito' },
              ]}
            />
          </FormField>

          {accountForm.account_type !== 'credit_card' ? (
            <FormField label="Saldo actual">
              <input type="number" value={accountForm.balance} onChange={e => setAccountForm({ ...accountForm, balance: Number(e.target.value) })} className={inputCls()} />
            </FormField>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Límite de crédito">
                  <input type="number" value={accountForm.credit_limit ?? ''} onChange={e => setAccountForm({ ...accountForm, credit_limit: e.target.value ? Number(e.target.value) : null })} placeholder="0" className={inputCls()} />
                </FormField>
                <FormField label="Saldo usado ahora">
                  <input type="number" value={accountForm.current_balance_used ?? ''} onChange={e => setAccountForm({ ...accountForm, current_balance_used: e.target.value ? Number(e.target.value) : null })} placeholder="0" className={inputCls()} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Día de corte">
                  <input type="number" min={1} max={31} value={accountForm.closing_day ?? ''} onChange={e => setAccountForm({ ...accountForm, closing_day: e.target.value ? Number(e.target.value) : null })} placeholder="15" className={inputCls()} />
                </FormField>
                <FormField label="Día de pago">
                  <input type="number" min={1} max={31} value={accountForm.payment_day ?? ''} onChange={e => setAccountForm({ ...accountForm, payment_day: e.target.value ? Number(e.target.value) : null })} placeholder="10" className={inputCls()} />
                </FormField>
              </div>
            </>
          )}

          <FormActions onCancel={() => setActiveModal(null)} onSave={saveAccount} saving={accountSaving} error={accountError} />
        </Modal>
      )}

      {/* Contribute to Goal Modal */}
      {contributeState && (
        <Modal title={`Ahorré este mes · ${contributeState.goal.name}`} onClose={() => setContributeState(null)}>
          <p className="text-xs text-black/50 dark:text-white/40 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl px-3 py-2">
            La aportación se sumará a tu ahorro acumulado y se descontará de tu disponible de este mes.
          </p>
          <FormField label="Monto ahorrado">
            <input
              type="number"
              min={0}
              step={0.01}
              value={contributeState.amount}
              onChange={e => setContributeState({ ...contributeState, amount: Number(e.target.value) })}
              className={inputCls()}
            />
            <p className="text-[10px] text-black/30 dark:text-white/30 mt-1">
              Meta mensual: {fmt(Number(contributeState.goal.monthly_contribution))} · Restante: {fmt(Math.max(0, Number(contributeState.goal.target_amount) - Number(contributeState.goal.current_amount)))}
            </p>
          </FormField>
          <FormActions
            onCancel={() => setContributeState(null)}
            onSave={handleContribute}
            saving={contributeSaving}
            saveLabel="Confirmar ahorro"
            error={contributeError}
          />
        </Modal>
      )}

      {/* Pay Card Month Modal */}
      {payCardState && (
        <Modal title={`Pagar tarjeta · ${payCardState.card.name}`} onClose={() => setPayCardState(null)}>
          <p className="text-xs text-black/50 dark:text-white/40 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl px-3 py-2">
            Los MSI vinculados avanzarán 1 cuota automáticamente. Ajusta los valores si tienes gastos no registrados en la app.
          </p>
          <FormField label="Pago a realizar">
            <input
              type="number"
              min={0}
              step={0.01}
              value={payCardState.amountToPay}
              onChange={e => {
                const val = Number(e.target.value)
                const currentUsed = Number(payCardState.card.current_balance_used) || 0
                setPayCardState({ ...payCardState, amountToPay: val, newBalanceUsed: Math.max(0, currentUsed - val) })
              }}
              className={inputCls()}
            />
          </FormField>
          <FormField label="Crédito usado después de pagar">
            <input
              type="number"
              min={0}
              step={0.01}
              value={payCardState.newBalanceUsed}
              onChange={e => setPayCardState({ ...payCardState, newBalanceUsed: Number(e.target.value) })}
              className={inputCls()}
            />
            <p className="text-[10px] text-black/30 dark:text-white/30 mt-1">
              Actual: {fmt(Number(payCardState.card.current_balance_used) || 0)} · Límite: {fmt(Number(payCardState.card.credit_limit) || 0)}
            </p>
          </FormField>
          <FormActions
            onCancel={() => setPayCardState(null)}
            onSave={handleConfirmPayCard}
            saving={payCardSaving}
            saveLabel="Confirmar pago"
            error={payCardError}
          />
        </Modal>
      )}

    </AppLayout>
  )
}
