'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import {
  getMonthlyIncome, getExpenses, getRecurringExpenses,
  getInstallmentPurchases, getAccounts, getTasks, getNotes,
} from '@/lib/api'
import type {
  MonthlyIncome, Expense, RecurringExpense, InstallmentPurchase, Account, Task, Note,
} from '@/lib/types'
import {
  DollarSign, CheckSquare, CalendarDays, StickyNote,
  Plus, X, CreditCard, Clock, ChevronRight,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function relDay(dateStr: string) {
  const d = daysUntil(dateStr)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d <= 6) {
    const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return names[new Date(dateStr + 'T00:00:00').getDay()]
  }
  return `${d} días`
}

function longDate() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Glass card shell ─────────────────────────────────────────────────────────

function GCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-white/40">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.07] text-white/50">{count}</span>
      )}
    </div>
  )
}

// ─── Note card colors ─────────────────────────────────────────────────────────

const NOTE_BG: Record<string, string> = {
  default: 'rgba(255,255,255,0.04)',
  rojo:    'rgba(120,15,15,0.5)',
  verde:   'rgba(10,65,58,0.5)',
  amarillo:'rgba(85,72,0,0.5)',
  morado:  'rgba(62,22,110,0.5)',
  azul:    'rgba(14,36,92,0.5)',
  rosa:    'rgba(102,16,66,0.5)',
}

const LABEL_COLORS_DARK: Record<string, { bg: string; color: string }> = {
  Trabajo:  { bg: 'rgba(13,148,136,0.25)',  color: '#2DD4BF' },
  Personal: { bg: 'rgba(124,58,237,0.25)',  color: '#C084FC' },
  Hogar:    { bg: 'rgba(5,150,105,0.25)',   color: '#4ADE80' },
  Finanzas: { bg: 'rgba(217,119,6,0.25)',   color: '#FBBF24' },
  Ideas:    { bg: 'rgba(225,29,72,0.25)',   color: '#FB7185' },
}

// ─── FAB speed-dial ───────────────────────────────────────────────────────────

const FAB_ACTIONS = [
  { key: 'nota',   label: 'Nota',   icon: <StickyNote size={16} />,  color: '#14B8A6', href: '/notas?new=1' },
  { key: 'evento', label: 'Evento', icon: <CalendarDays size={16} />,color: '#3B82F6', href: '/events?new=1' },
  { key: 'tarea',  label: 'Tarea',  icon: <CheckSquare size={16} />, color: '#6B46E5', href: '/to_do?new=1' },
  { key: 'gasto',  label: 'Gasto',  icon: <DollarSign size={16} />,  color: '#A8FF3E', href: '/dashboard?new=1' },
]

function SpeedDial() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Options */}
      {FAB_ACTIONS.map((a, i) => (
        <div
          key={a.key}
          className="flex items-center gap-3 transition-all duration-300"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0) scale(1)' : `translateY(${(i + 1) * 12}px) scale(0.85)`,
            transitionDelay: open ? `${i * 50}ms` : `${(FAB_ACTIONS.length - 1 - i) * 30}ms`,
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          <span className="text-sm font-medium text-white/80 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 whitespace-nowrap">
            {a.label}
          </span>
          <button
            onClick={() => { setOpen(false); router.push(a.href) }}
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg text-white transition-all duration-150 hover:scale-110 active:scale-95"
            style={{ background: a.color, color: a.key === 'gasto' ? '#0A0A0A' : '#fff' }}
          >
            {a.icon}
          </button>
        </div>
      ))}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl text-white transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
      >
        <span className={`transition-transform duration-300 ${open ? 'rotate-45' : 'rotate-0'}`}>
          {open ? <X size={22} /> : <Plus size={22} />}
        </span>
      </button>

      {/* Backdrop to close */}
      {open && (
        <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [income, setIncome] = useState<MonthlyIncome | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [installments, setInstallments] = useState<InstallmentPurchase[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getMonthlyIncome(),
      getExpenses(),
      getRecurringExpenses(),
      getInstallmentPurchases(),
      getAccounts(),
      getTasks({ is_event: false }),
      getTasks({ is_event: true }),
      getNotes(),
    ]).then(([inc, exp, rec, inst, acc, tsk, evt, nts]) => {
      if (inc.status === 'fulfilled') setIncome(inc.value)
      if (exp.status === 'fulfilled') setExpenses(exp.value)
      if (rec.status === 'fulfilled') setRecurring(rec.value)
      if (inst.status === 'fulfilled') setInstallments(inst.value)
      if (acc.status === 'fulfilled') setAccounts(acc.value)
      if (tsk.status === 'fulfilled') setTasks(tsk.value)
      if (evt.status === 'fulfilled') setEvents(evt.value)
      if (nts.status === 'fulfilled') setNotes(nts.value)
    }).finally(() => setLoading(false))
  }, [])

  // ── Finance calculations ───────────────────────────────────────────────────

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const gastado = useMemo(() =>
    expenses
      .filter(e => {
        const d = new Date(e.date)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
          && (e.payment_method === 'cash' || e.payment_method === 'debit')
      })
      .reduce((s, e) => s + e.amount, 0),
    [expenses, thisMonth, thisYear]
  )

  const compromisos = useMemo(() => {
    const rec = recurring.filter(r => r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0)
    const msi = installments.reduce((s, i) => s + i.monthly_amount, 0)
    return rec + msi
  }, [recurring, installments])

  const disponible = (income?.amount ?? 0) - compromisos - gastado

  // ── Upcoming credit card payments ──────────────────────────────────────────

  const upcomingPayments = useMemo(() => {
    return accounts
      .filter(a => a.account_type === 'credit_card' && a.payment_day != null)
      .map(a => {
        const payDay = a.payment_day!
        const thisMonthDate = new Date(thisYear, thisMonth, payDay)
        const nextMonthDate = new Date(thisYear, thisMonth + 1, payDay)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const target = thisMonthDate >= today ? thisMonthDate : nextMonthDate
        const days = Math.round((target.getTime() - today.getTime()) / 86400000)
        return { account: a, days }
      })
      .filter(p => p.days >= 0 && p.days <= 7)
      .sort((a, b) => a.days - b.days)
  }, [accounts, thisMonth, thisYear])

  // ── Today's tasks ──────────────────────────────────────────────────────────

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.due_date === todayISO() && !t.is_completed),
    [tasks]
  )

  // ── Upcoming events (next 7 days) ──────────────────────────────────────────

  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const inSeven = new Date(today); inSeven.setDate(inSeven.getDate() + 7)
    return events
      .filter(e => {
        if (!e.due_date) return false
        const d = new Date(e.due_date + 'T00:00:00')
        return d >= today && d <= inSeven
      })
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [events])

  // ── Recent notes (< 7 days) ────────────────────────────────────────────────

  const recentNotes = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return notes.filter(n => new Date(n.created_at) >= cutoff)
  }, [notes])

  // ─── Render ────────────────────────────────────────────────────────────────

  const shimmer = 'animate-pulse rounded-xl bg-white/[0.06] h-5'

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pb-28 space-y-5">

        {/* Header */}
        <div className="pt-2 pb-1">
          <p className="text-white/40 text-sm capitalize">{longDate()}</p>
          <h1 className="text-3xl font-bold text-white mt-0.5">
            {greeting()}, <span style={{ background: 'linear-gradient(135deg,#FF6B9D,#6B46E5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sebastian</span> 👋
          </h1>
        </div>

        {/* ── Finance card ────────────────────────────────────────────────── */}
        <GCard>
          <SectionTitle icon={<DollarSign size={14} />} label="Finanzas del mes" />

          {loading ? (
            <div className="space-y-3">
              <div className={`${shimmer} h-10 w-48`} />
              <div className="flex gap-3">
                <div className={`${shimmer} flex-1`} />
                <div className={`${shimmer} flex-1`} />
                <div className={`${shimmer} flex-1`} />
              </div>
            </div>
          ) : income ? (
            <>
              {/* Big available number */}
              <div className="mb-4">
                <p className="text-xs text-white/35 mb-0.5">Disponible este mes</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: disponible >= 0 ? '#A8FF3E' : '#FF4444' }}>
                  {fmt(disponible)}
                </p>
              </div>

              {/* 3 sub-metrics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Ingreso', value: fmt(income.amount), color: 'text-white/80' },
                  { label: 'Compromisos', value: fmt(compromisos), color: 'text-amber-400' },
                  { label: 'Gastado', value: fmt(gastado), color: 'text-white/60' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">{m.label}</p>
                    <p className={`text-sm font-semibold tabular-nums ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Upcoming payments */}
              {upcomingPayments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Pagos próximos</p>
                  <div className="flex flex-wrap gap-2">
                    {upcomingPayments.map(p => (
                      <div key={p.account.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-amber-500/10 border-amber-500/25">
                        <CreditCard size={12} className="text-amber-400" />
                        <span className="text-xs text-amber-300 font-medium">{p.account.name}</span>
                        <span className="text-xs text-amber-400/70">{p.days === 0 ? 'Hoy' : p.days === 1 ? 'Mañana' : `${p.days} días`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-white/30 text-sm mb-3">No has configurado tu ingreso mensual</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-xs px-4 py-2 rounded-xl font-medium text-white"
                style={{ background: '#6B46E5' }}
              >
                Configurar en Finanzas
              </button>
            </div>
          )}
        </GCard>

        {/* ── Tasks + Events row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Tasks today */}
          <GCard>
            <SectionTitle icon={<CheckSquare size={14} />} label="Recordatorios de hoy" count={todayTasks.length} />
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className={shimmer} />)}</div>
            ) : todayTasks.length === 0 ? (
              <p className="text-white/25 text-sm py-2">Sin tareas para hoy 🎉</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2.5 group">
                    <div className="mt-0.5 w-4 h-4 rounded-full border border-white/20 flex-shrink-0 group-hover:border-[#6B46E5] transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{t.title}</p>
                      {t.label && (
                        <span className="text-[10px] text-white/35">{t.label}</span>
                      )}
                    </div>
                    {t.due_time && (
                      <span className="text-[10px] text-white/30 flex items-center gap-0.5 flex-shrink-0">
                        <Clock size={9} />{t.due_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                ))}
                {todayTasks.length > 5 && (
                  <button onClick={() => router.push('/to_do')} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors mt-1">
                    +{todayTasks.length - 5} más <ChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => router.push('/to_do')}
              className="mt-4 text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1"
            >
              Ver todas las tareas <ChevronRight size={10} />
            </button>
          </GCard>

          {/* Upcoming events */}
          <GCard>
            <SectionTitle icon={<CalendarDays size={14} />} label="Próximos 7 días" count={upcomingEvents.length} />
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className={shimmer} />)}</div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-white/25 text-sm py-2">Agenda libre esta semana ✨</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-center w-10">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6B46E5]/20 text-[#AF9BFF]">
                        {e.due_date ? relDay(e.due_date) : '—'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{e.title}</p>
                      {e.due_time && (
                        <span className="text-[10px] text-white/35 flex items-center gap-0.5">
                          <Clock size={9} />{e.due_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {upcomingEvents.length > 5 && (
                  <button onClick={() => router.push('/events')} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors mt-1">
                    +{upcomingEvents.length - 5} más <ChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => router.push('/events')}
              className="mt-4 text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1"
            >
              Ver todos los eventos <ChevronRight size={10} />
            </button>
          </GCard>
        </div>

        {/* ── Recent notes ────────────────────────────────────────────────── */}
        {!loading && recentNotes.length > 0 && (
          <GCard>
            <SectionTitle icon={<StickyNote size={14} />} label="Notas recientes" count={recentNotes.length} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentNotes.slice(0, 6).map(n => {
                const ls = LABEL_COLORS_DARK[n.label ?? ''] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
                return (
                  <button
                    key={n.id}
                    onClick={() => router.push('/notas')}
                    className="text-left rounded-xl p-3 border border-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                    style={{ background: NOTE_BG[n.color] ?? NOTE_BG.default }}
                  >
                    <p className="text-sm font-semibold text-white/90 line-clamp-2 mb-2">{n.title}</p>
                    {n.label && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: ls.bg, color: ls.color }}>
                        {n.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {recentNotes.length > 6 && (
              <button onClick={() => router.push('/notas')} className="mt-3 text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1">
                Ver todas las notas <ChevronRight size={10} />
              </button>
            )}
          </GCard>
        )}
      </div>

      <SpeedDial />
    </AppLayout>
  )
}
