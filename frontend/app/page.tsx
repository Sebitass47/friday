'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import {
  getProjection, getAccounts, getTasks, getNotes,
} from '@/lib/api'
import type {
  MonthProjection, Account, Task, Note,
} from '@/lib/types'
import {
  DollarSign, CheckSquare, CalendarDays, StickyNote,
  Plus, X, CreditCard, Clock, ChevronRight,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useIsDark() {
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

function safe(n: unknown): number {
  const v = Number(n ?? 0)
  return isNaN(v) || !isFinite(v) ? 0 : v
}

function fmt(n: unknown) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(safe(n))
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function longDate() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function relDay(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const d = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][target.getDay()]
}

// ─── GCard ────────────────────────────────────────────────────────────────────

function GCard({ children, className = '', isDark }: { children: React.ReactNode; className?: string; isDark: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
        backdropFilter: isDark ? 'blur(20px)' : 'none',
        boxShadow: isDark ? 'none' : '0 1px 6px rgba(0,0,0,0.07)',
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ icon, label, count, isDark }: { icon: React.ReactNode; label: string; count?: number; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }}
        >{count}</span>
      )}
    </div>
  )
}

// ─── Spending bar chart ───────────────────────────────────────────────────────

function SpendingBar({ income, compromisos, gastado, isDark }: { income: number; compromisos: number; gastado: number; isDark: boolean }) {
  const total = income > 0 ? income : 1
  const pComp = Math.min(safe(compromisos) / total, 1)
  const pGast = Math.min(safe(gastado) / total, Math.max(1 - pComp, 0))
  const pDisp = Math.max(1 - pComp - pGast, 0)

  const greenColor = isDark ? '#A8FF3E' : '#16a34a'

  return (
    <div className="mt-4">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {pComp > 0 && (
          <div style={{ width: `${pComp * 100}%`, background: '#f59e0b', borderRadius: '999px', flexShrink: 0 }} />
        )}
        {pGast > 0 && (
          <div style={{ width: `${pGast * 100}%`, background: '#6B46E5', borderRadius: '999px', flexShrink: 0 }} />
        )}
        {pDisp > 0 && (
          <div style={{ width: `${pDisp * 100}%`, background: greenColor, borderRadius: '999px', flexShrink: 0 }} />
        )}
        {pComp === 0 && pGast === 0 && pDisp === 0 && (
          <div className="flex-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {[
          { label: 'Compromisos', pct: pComp, color: '#f59e0b' },
          { label: 'Gastado', pct: pGast, color: '#6B46E5' },
          { label: 'Disponible', pct: pDisp, color: greenColor },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#6b7280' }}>
              {label} <span className="font-semibold">{(pct * 100).toFixed(0)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Note card colors ──────────────────────────────────────────────────────────

const NOTE_BG_DARK: Record<string, string> = {
  default: 'rgba(255,255,255,0.04)', rojo: 'rgba(120,15,15,0.5)',
  verde: 'rgba(10,65,58,0.5)', amarillo: 'rgba(85,72,0,0.5)',
  morado: 'rgba(62,22,110,0.5)', azul: 'rgba(14,36,92,0.5)', rosa: 'rgba(102,16,66,0.5)',
}
const NOTE_BG_LIGHT: Record<string, string> = {
  default: '#f9fafb', rojo: '#fee2e2', verde: '#ccfbf1',
  amarillo: '#fef9c3', morado: '#f3e8ff', azul: '#dbeafe', rosa: '#fce7f3',
}
const LABEL_COLORS: Record<string, { dark: string; light: string }> = {
  Trabajo:  { dark: '#2DD4BF', light: '#0d9488' },
  Personal: { dark: '#C084FC', light: '#7c3aed' },
  Hogar:    { dark: '#4ADE80', light: '#16a34a' },
  Finanzas: { dark: '#FBBF24', light: '#b45309' },
  Ideas:    { dark: '#FB7185', light: '#e11d48' },
}

// ─── FAB speed-dial ───────────────────────────────────────────────────────────

const FAB_ACTIONS = [
  { key: 'nota',   label: 'Nota',   icon: <StickyNote size={16} />,   color: '#14B8A6', href: '/notas?new=1' },
  { key: 'evento', label: 'Evento', icon: <CalendarDays size={16} />, color: '#3B82F6', href: '/events?new=1' },
  { key: 'tarea',  label: 'Tarea',  icon: <CheckSquare size={16} />,  color: '#6B46E5', href: '/to_do?new=1' },
  { key: 'gasto',  label: 'Gasto',  icon: <DollarSign size={16} />,   color: '#A8FF3E', href: '/dashboard?new=1' },
]

function SpeedDial() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-3">
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
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 hover:scale-110 active:scale-95"
            style={{ background: a.color, color: a.key === 'gasto' ? '#0A0A0A' : '#fff' }}
          >
            {a.icon}
          </button>
        </div>
      ))}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl text-white transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
      >
        <span className={`transition-transform duration-300 ${open ? 'rotate-45' : 'rotate-0'} flex`}>
          {open ? <X size={22} /> : <Plus size={22} />}
        </span>
      </button>
      {open && <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const isDark = useIsDark()
  const router = useRouter()

  const [currentCycle, setCurrentCycle] = useState<MonthProjection | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [hasIncome, setHasIncome] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getProjection(1),
      getAccounts(),
      getTasks({ is_event: false }),
      getTasks({ is_event: true }),
      getNotes(),
    ]).then(([proj, acc, tsk, evt, nts]) => {
      if (proj.status === 'fulfilled') {
        setCurrentCycle(proj.value.months[0] ?? null)
      } else {
        setHasIncome(false)
      }
      if (acc.status === 'fulfilled') setAccounts(acc.value)
      if (tsk.status === 'fulfilled') setTasks(tsk.value)
      if (evt.status === 'fulfilled') setEvents(evt.value)
      if (nts.status === 'fulfilled') setNotes(nts.value)
    }).finally(() => setLoading(false))
  }, [])

  // ── Derived values from projection ────────────────────────────────────────

  const incomeAmt = safe(currentCycle?.income)
  const compromisos = safe(currentCycle?.recurring_expenses) + safe(currentCycle?.installments) + safe(currentCycle?.savings_contributions)
  const gastado = safe(currentCycle?.cash_debit_spent)
  const disponible = safe(currentCycle?.available)
  const cycleHasIncome = hasIncome && currentCycle !== null

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const upcomingPayments = useMemo(() => {
    return accounts
      .filter(a => a.account_type === 'credit_card' && a.payment_day != null)
      .map(a => {
        const payDay = a.payment_day!
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const thisM = new Date(thisYear, thisMonth, payDay)
        const nextM = new Date(thisYear, thisMonth + 1, payDay)
        const target = thisM >= today ? thisM : nextM
        const days = Math.round((target.getTime() - today.getTime()) / 86400000)
        return { account: a, days }
      })
      .filter(p => p.days >= 0 && p.days <= 7)
      .sort((a, b) => a.days - b.days)
  }, [accounts, thisMonth, thisYear])

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.due_date === todayISO() && !t.is_completed),
    [tasks]
  )

  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7)
    return events
      .filter(e => {
        if (!e.due_date) return false
        const d = new Date(e.due_date + 'T00:00:00')
        return d >= today && d <= in7
      })
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [events])

  const recentNotes = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return notes.filter(n => new Date(n.created_at) >= cutoff)
  }, [notes])

  // ── Styles ─────────────────────────────────────────────────────────────────

  const txt = (opacity = 1) => isDark ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity * 0.87})`
  const txtMuted = isDark ? 'rgba(255,255,255,0.4)' : '#6b7280'
  const shimmer = `animate-pulse rounded-xl h-5 ${isDark ? 'bg-white/[0.07]' : 'bg-gray-200'}`
  const subCard = {
    background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pb-28 space-y-4 sm:space-y-5">

        {/* Header */}
        <div className="pt-1 pb-0.5">
          <p className="text-sm capitalize" style={{ color: txtMuted }}>{longDate()}</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-0.5" style={{ color: txt(1) }}>
            {greeting()},{' '}
            <span style={{ background: 'linear-gradient(135deg,#FF6B9D,#6B46E5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sebastian
            </span>{' '}👋
          </h1>
        </div>

        {/* ── Finance card ──────────────────────────────────────────────────── */}
        <GCard isDark={isDark}>
          <SectionTitle isDark={isDark} icon={<DollarSign size={14} />} label="Finanzas del mes" />

          {loading ? (
            <div className="space-y-3">
              <div className={`${shimmer} h-9 w-44`} />
              <div className="flex gap-3">
                <div className={`${shimmer} flex-1`} />
                <div className={`${shimmer} flex-1`} />
                <div className={`${shimmer} flex-1`} />
              </div>
              <div className={`${shimmer} h-2.5 w-full`} />
            </div>
          ) : cycleHasIncome ? (
            <>
              {/* Cycle label */}
              {currentCycle && (
                <p className="text-[10px] mb-3" style={{ color: txtMuted }}>
                  Ciclo: {currentCycle.label}
                </p>
              )}

              {/* Available */}
              <div className="mb-4">
                <p className="text-xs mb-0.5" style={{ color: txtMuted }}>Disponible este ciclo</p>
                <p className={`text-3xl sm:text-4xl font-bold tabular-nums ${disponible >= 0 ? (isDark ? 'text-white' : 'text-black') : ''}`}
                  style={disponible < 0 ? { color: '#FF6B6B' } : {}}>
                  {fmt(disponible)}
                </p>
              </div>

              {/* 3 sub-metrics */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: 'Ingreso',      value: fmt(incomeAmt),   color: txt(0.85) },
                  { label: 'Compromisos',  value: fmt(compromisos), color: isDark ? '#fbbf24' : '#b45309' },
                  { label: 'Gastado',      value: fmt(gastado),     color: txt(0.55) },
                ].map(m => (
                  <div key={m.label} className="rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5" style={subCard}>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: txtMuted }}>{m.label}</p>
                    <p className="text-xs sm:text-sm font-semibold tabular-nums truncate" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>

              <SpendingBar income={incomeAmt} compromisos={compromisos} gastado={gastado} isDark={isDark} />

              {/* Upcoming card payments */}
              {upcomingPayments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: txtMuted }}>Pagos próximos</p>
                  <div className="flex flex-wrap gap-2">
                    {upcomingPayments.map(p => (
                      <div key={p.account.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <CreditCard size={12} style={{ color: '#f59e0b' }} />
                        <span className="text-xs font-medium" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>{p.account.name}</span>
                        <span className="text-xs" style={{ color: isDark ? 'rgba(252,211,77,0.6)' : '#b45309' }}>
                          {p.days === 0 ? 'Hoy' : p.days === 1 ? 'Mañana' : `${p.days} días`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm mb-3" style={{ color: txtMuted }}>No tienes ingreso mensual configurado</p>
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

        {/* ── Tasks + Events ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">

          {/* Tasks today */}
          <GCard isDark={isDark}>
            <SectionTitle isDark={isDark} icon={<CheckSquare size={14} />} label="Recordatorios de hoy" count={todayTasks.length} />
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className={shimmer} />)}</div>
            ) : todayTasks.length === 0 ? (
              <p className="text-sm py-2" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#d1d5db' }}>Sin tareas para hoy 🎉</p>
            ) : (
              <div className="space-y-2.5">
                {todayTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2.5 group">
                    <div className="mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 transition-colors"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: txt(0.8) }}>{t.title}</p>
                      {t.label && <span className="text-[10px]" style={{ color: txtMuted }}>{t.label}</span>}
                    </div>
                    {t.due_time && (
                      <span className="text-[10px] flex items-center gap-0.5 flex-shrink-0" style={{ color: txtMuted }}>
                        <Clock size={9} />{t.due_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                ))}
                {todayTasks.length > 5 && (
                  <button onClick={() => router.push('/to_do')}
                    className="text-xs flex items-center gap-1 transition-colors"
                    style={{ color: txtMuted }}>
                    +{todayTasks.length - 5} más <ChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
            <button onClick={() => router.push('/to_do')}
              className="mt-4 text-xs flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ color: txtMuted }}>
              Ver todas las tareas <ChevronRight size={10} />
            </button>
          </GCard>

          {/* Upcoming events */}
          <GCard isDark={isDark}>
            <SectionTitle isDark={isDark} icon={<CalendarDays size={14} />} label="Próximos 7 días" count={upcomingEvents.length} />
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className={shimmer} />)}</div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm py-2" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#d1d5db' }}>Agenda libre ✨</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(107,70,229,0.15)', color: isDark ? '#af9bff' : '#6B46E5' }}>
                      {e.due_date ? relDay(e.due_date) : '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: txt(0.8) }}>{e.title}</p>
                      {e.due_time && (
                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: txtMuted }}>
                          <Clock size={9} />{e.due_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {upcomingEvents.length > 5 && (
                  <button onClick={() => router.push('/events')}
                    className="text-xs flex items-center gap-1" style={{ color: txtMuted }}>
                    +{upcomingEvents.length - 5} más <ChevronRight size={10} />
                  </button>
                )}
              </div>
            )}
            <button onClick={() => router.push('/events')}
              className="mt-4 text-xs flex items-center gap-1 hover:opacity-70 transition-colors"
              style={{ color: txtMuted }}>
              Ver todos los eventos <ChevronRight size={10} />
            </button>
          </GCard>
        </div>

        {/* ── Recent notes ──────────────────────────────────────────────────── */}
        {!loading && recentNotes.length > 0 && (
          <GCard isDark={isDark}>
            <SectionTitle isDark={isDark} icon={<StickyNote size={14} />} label="Notas recientes" count={recentNotes.length} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {recentNotes.slice(0, 6).map(n => {
                const bg = isDark ? (NOTE_BG_DARK[n.color] ?? NOTE_BG_DARK.default) : (NOTE_BG_LIGHT[n.color] ?? NOTE_BG_LIGHT.default)
                const lc = LABEL_COLORS[n.label ?? '']
                return (
                  <button
                    key={n.id}
                    onClick={() => router.push('/notas')}
                    className="text-left rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: bg,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                      boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    <p className="text-sm font-semibold line-clamp-2 mb-2" style={{ color: txt(0.9) }}>{n.title}</p>
                    {n.label && lc && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: isDark ? `${lc.dark}22` : `${lc.light}22`, color: isDark ? lc.dark : lc.light }}>
                        {n.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {recentNotes.length > 6 && (
              <button onClick={() => router.push('/notas')}
                className="mt-3 text-xs flex items-center gap-1 hover:opacity-70 transition-colors"
                style={{ color: txtMuted }}>
                Ver todas <ChevronRight size={10} />
              </button>
            )}
          </GCard>
        )}
      </div>

      <SpeedDial />
    </AppLayout>
  )
}
