'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ProjectionChart from '@/components/charts/ProjectionChart'
import {
  getProjection, getInstallmentPurchases, getSavingsGoals, getMe,
  getRecurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
  createInstallmentPurchase, updateInstallmentPurchase, deleteInstallmentPurchase,
  createSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
  createExpense, createIncome, getAccounts, setMonthlyIncome,
} from '@/lib/api'
import type {
  ProjectionResponse, InstallmentPurchase, SavingsGoal,
  RecurringExpense, User, Account,
} from '@/lib/types'
import {
  TrendingUp, TrendingDown, Minus, CreditCard, Target,
  RefreshCw, Plus, X, Pencil, Trash2, CheckCircle2, CalendarDays,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const pct = (cur: number, tot: number) => Math.min(100, Math.round((cur / tot) * 100))
const today = () => new Date().toISOString().split('T')[0]

const ACCENT = 'text-[#6B46E5] dark:text-[#AF9BFF]'
const ACCENT_BG = 'bg-[#6B46E5] dark:bg-[#AF9BFF]'
const ACCENT_BG_SOFT = 'bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10'
const ACCENT_BORDER = 'border-[#6B46E5]/20 dark:border-[#AF9BFF]/20'
const CORAL = '#FF6B6B'

type ActiveModal = 'register' | 'msi' | 'goal' | 'recurring' | null

const MSI_EMPTY = { name: '', total_amount: 0, monthly_amount: 0, total_installments: 12, remaining_installments: 12, start_date: today() }
const GOAL_EMPTY = { name: '', target_amount: 0, current_amount: 0, monthly_contribution: 0 }
const REC_EMPTY = { name: '', amount: 0, frequency: 'monthly' as RecurringExpense['frequency'], interval_days: null as number | null }

function inputCls() {
  return 'w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#6B46E5] dark:focus:border-[#AF9BFF] transition-colors'
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#141414] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
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

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [msi, setMsi] = useState<InstallmentPurchase[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // MSI form
  const [msiForm, setMsiForm] = useState<typeof MSI_EMPTY & { id?: string }>(MSI_EMPTY)
  const [msiSaving, setMsiSaving] = useState(false)
  const [msiError, setMsiError] = useState('')

  // Goal form
  const [goalForm, setGoalForm] = useState<typeof GOAL_EMPTY & { id?: string }>(GOAL_EMPTY)
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState('')

  // Recurring form
  const [recForm, setRecForm] = useState<typeof REC_EMPTY & { id?: string }>(REC_EMPTY)
  const [recSaving, setRecSaving] = useState(false)
  const [recError, setRecError] = useState('')

  // Register (quick transaction)
  const [regMode, setRegMode] = useState<'expense' | 'income'>('expense')
  const [regAmount, setRegAmount] = useState('')
  const [regDesc, setRegDesc] = useState('')
  const [regMethod, setRegMethod] = useState<'cash' | 'debit' | 'credit'>('cash')
  const [regAccountId, setRegAccountId] = useState('')
  const [regCategory, setRegCategory] = useState('')
  const [regIsMonthly, setRegIsMonthly] = useState(false)
  const [regSaving, setRegSaving] = useState(false)
  const [regError, setRegError] = useState('')

  useEffect(() => {
    Promise.all([getMe(), getProjection(12), getInstallmentPurchases(), getSavingsGoals(), getRecurringExpenses()])
      .then(([u, p, m, g, r]) => { setUser(u); setProjection(p); setMsi(m); setGoals(g); setRecurring(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function openRegister() {
    setRegAmount(''); setRegDesc(''); setRegMethod('cash'); setRegAccountId(''); setRegCategory(''); setRegIsMonthly(false); setRegError('')
    getAccounts().then(setAccounts).catch(console.error)
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
        if (regIsMonthly) await setMonthlyIncome(parseFloat(regAmount))
      }
      setActiveModal(null)
      const p = await getProjection(12)
      setProjection(p)
    } catch { setRegError('Error al guardar') }
    finally { setRegSaving(false) }
  }

  // MSI CRUD
  function openNewMsi() { setMsiForm({ ...MSI_EMPTY, start_date: today() }); setMsiError(''); setActiveModal('msi') }
  function openEditMsi(item: InstallmentPurchase) {
    setMsiForm({ name: item.name, total_amount: Number(item.total_amount), monthly_amount: Number(item.monthly_amount), total_installments: item.total_installments, remaining_installments: item.remaining_installments, start_date: item.start_date, id: item.id })
    setMsiError(''); setActiveModal('msi')
  }
  async function saveMsi() {
    if (!msiForm.name.trim()) { setMsiError('El nombre es requerido'); return }
    if (msiForm.monthly_amount <= 0) { setMsiError('El pago mensual debe ser mayor a 0'); return }
    setMsiSaving(true); setMsiError('')
    try {
      if (msiForm.id) await updateInstallmentPurchase(msiForm.id, msiForm)
      else await createInstallmentPurchase(msiForm)
      setMsi(await getInstallmentPurchases()); setActiveModal(null)
    } catch (e: unknown) { setMsiError(e instanceof Error ? e.message : 'Error') }
    finally { setMsiSaving(false) }
  }
  async function deleteMsi(id: string) {
    if (!confirm('¿Eliminar este MSI?')) return
    await deleteInstallmentPurchase(id)
    setMsi(prev => prev.filter(i => i.id !== id))
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

  const cardCls = 'bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.14] dark:hover:border-white/[0.14] transition-all shadow-sm'

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
          <button
            onClick={openRegister}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 ${ACCENT_BG}`}
          >
            <Plus size={15} strokeWidth={2.5} />
            Registrar
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Disponible */}
          <div className={`${cardCls} p-6`}>
            <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">Disponible este mes</p>
            <p className={`text-4xl font-bold tabular-nums`} style={{ color: isNeg ? CORAL : undefined, ...(isNeg ? {} : {}) }}>
              <span className={isNeg ? '' : 'text-black dark:text-white'}>{fmt(available)}</span>
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

          {/* Ingreso + Compromisos */}
          <div className="flex flex-col gap-4">
            <div className={`${cardCls} p-5 flex-1`}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest">Ingreso mensual</p>
              </div>
              <p className="text-2xl font-semibold text-black dark:text-white tabular-nums">{fmt(thisMonth?.income ?? 0)}</p>
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

        {/* Chart */}
        <div className={`${cardCls} p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-black dark:text-white">Proyección · 12 meses</h2>
              <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Dinero disponible mes a mes</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-black/40 dark:text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#6B46E5]/70 dark:bg-[#AF9BFF]/70" />
                Positivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: `${CORAL}b3` }} />
                Déficit
              </span>
            </div>
          </div>
          {projection && <ProjectionChart months={projection.months} />}
        </div>

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
              <div className="space-y-3.5">
                {activeMsi.slice(0, 4).map(item => {
                  const paid = item.total_installments - item.remaining_installments
                  const progress = pct(paid, item.total_installments)
                  return (
                    <div key={item.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-black dark:text-white truncate max-w-[55%]">{item.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-black/40 dark:text-white/40 tabular-nums">{fmt(Number(item.monthly_amount))}/mes</span>
                          <button onClick={() => openEditMsi(item)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-all"><Pencil size={11} /></button>
                          <button onClick={() => deleteMsi(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-black/30 dark:text-white/30 hover:text-[#FF6B6B] transition-all"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                        <div className="h-1 rounded-full bg-[#6B46E5]/60 dark:bg-[#AF9BFF]/60" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-black/25 dark:text-white/25 mt-0.5">{paid} de {item.total_installments} meses</p>
                    </div>
                  )
                })}
                {activeMsi.length > 4 && (
                  <p className="text-xs text-black/30 dark:text-white/30 text-center pt-1">+{activeMsi.length - 4} más</p>
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
                  return (
                    <div key={g.id} className="group">
                      <div className="flex items-center justify-between mb-1">
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
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-black/25 dark:text-white/25">{fmt(Number(g.current_amount))} de {fmt(Number(g.target_amount))}</p>
                        {g.estimated_completion_date && (
                          <div className="flex items-center gap-0.5 text-[10px] text-black/25 dark:text-white/25">
                            <CalendarDays size={9} />
                            <span>{new Date(g.estimated_completion_date + 'T00:00:00').toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>
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
          {/* Mode toggle */}
          <div className="flex rounded-xl border border-black/10 dark:border-white/10 overflow-hidden p-0.5 bg-black/[0.03] dark:bg-white/[0.03]">
            {(['expense', 'income'] as const).map(m => (
              <button key={m} onClick={() => setRegMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${regMode === m ? `${ACCENT_BG} text-white` : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}>
                {m === 'expense' ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <FormField label="Monto">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-black/40 dark:text-white/40">$</span>
              <input
                type="number" step="0.01" placeholder="0.00" value={regAmount}
                onChange={e => setRegAmount(e.target.value)}
                className={`${inputCls()} pl-7 text-xl font-bold`}
              />
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
                  <select value={regAccountId} onChange={e => setRegAccountId(e.target.value)} className={inputCls()}>
                    <option value="">Selecciona</option>
                    {accounts.filter(a => regMethod === 'credit' ? a.account_type === 'credit_card' : a.account_type !== 'credit_card').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </FormField>
              )}
            </>
          )}

          <FormField label="Categoría (opcional)">
            <input placeholder="Alimentación, Transporte…" value={regCategory} onChange={e => setRegCategory(e.target.value)} className={inputCls()} />
          </FormField>

          {regMode === 'income' && (
            <button
              type="button"
              onClick={() => setRegIsMonthly(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${regIsMonthly ? `${ACCENT_BG_SOFT} ${ACCENT_BORDER} ${ACCENT}` : 'border-black/10 dark:border-white/10 text-black/50 dark:text-white/50'}`}
            >
              <span>¿Es tu ingreso mensual fijo?</span>
              <span className={`w-8 h-4 rounded-full transition-all flex items-center px-0.5 ${regIsMonthly ? 'bg-[#6B46E5] dark:bg-[#AF9BFF] justify-end' : 'bg-black/10 dark:bg-white/10 justify-start'}`}>
                <span className="w-3 h-3 rounded-full bg-white" />
              </span>
            </button>
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
            <input type="date" value={msiForm.start_date} onChange={e => setMsiForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls()} />
          </FormField>
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
            <select value={recForm.frequency} onChange={e => setRecForm(f => ({ ...f, frequency: e.target.value as RecurringExpense['frequency'] }))} className={inputCls()}>
              <option value="monthly">Mensual</option>
              <option value="weekly">Semanal</option>
              <option value="custom">Personalizado</option>
            </select>
          </FormField>
          {recForm.frequency === 'custom' && (
            <FormField label="Cada cuántos días">
              <input type="number" min={1} value={recForm.interval_days ?? ''} onChange={e => setRecForm(f => ({ ...f, interval_days: e.target.value ? Number(e.target.value) : null }))} className={inputCls()} />
            </FormField>
          )}
          <FormActions onCancel={() => setActiveModal(null)} onSave={saveRec} saving={recSaving} error={recError} />
        </Modal>
      )}

    </AppLayout>
  )
}
