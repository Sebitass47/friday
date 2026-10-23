'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getStats } from '@/lib/api'
import type { Stats, HabitStats, FinanceStats, HeatCell } from '@/lib/types'

type Tab = 'habitos' | 'tareas' | 'finanzas'

const TABS: { key: Tab; label: string }[] = [
  { key: 'habitos', label: 'Hábitos' },
  { key: 'tareas', label: 'Recordatorios y listas' },
  { key: 'finanzas', label: 'Finanzas' },
]

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const GREEN = '#34d399'
const CORAL = '#FF6B6B'

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')

function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>
      {title && <h2 className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-3">{title}</h2>}
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className="text-2xl sm:text-3xl font-semibold tabular-nums mt-1 text-black dark:text-white" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-black/[0.07] dark:bg-white/[0.08] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

// ── Hábitos ───────────────────────────────────────────────────────────────────

function Heatmap({ cells }: { cells: HeatCell[] }) {
  const weeks: HeatCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const bg = (c: HeatCell): string => {
    if (c.scheduled === 0) return 'transparent'
    const r = c.done / c.scheduled
    if (r === 0) return 'rgba(127,127,127,0.14)'
    return `rgba(52,211,153,${0.3 + r * 0.7})`
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-col gap-1 text-[10px] text-black/35 dark:text-white/35 pt-px">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="h-4 sm:h-[18px] leading-4 sm:leading-[18px]">{d}</span>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {w.map(c => (
            <div
              key={c.date}
              title={`${fmtDate(c.date)} · ${c.scheduled ? `${c.done}/${c.scheduled}` : '—'}`}
              className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-[5px]"
              style={{ background: bg(c), border: c.scheduled === 0 ? '1px dashed rgba(127,127,127,0.18)' : 'none' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function WeeklyBars({ weekly }: { weekly: HabitStats['weekly'] }) {
  const H = 90
  return (
    <svg viewBox={`0 0 ${weekly.length * 40} ${H + 22}`} className="w-full h-32 text-black dark:text-white">
      {weekly.map((w, i) => {
        const h = (w.pct / 100) * H
        const [, m, d] = w.week_start.split('-')
        return (
          <g key={w.week_start} transform={`translate(${i * 40 + 6},0)`}>
            <rect x="0" y="0" width="28" height={H} rx="6" fill="currentColor" opacity="0.06" />
            <rect x="0" y={H - h} width="28" height={h} rx="6" fill={GREEN} opacity={w.pct === 0 ? 0 : 0.85} />
            <text x="14" y={H - h - 4 < 10 ? 12 : H - h - 4} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">{w.pct ? `${w.pct}%` : ''}</text>
            <text x="14" y={H + 14} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.4">{`${d}/${m}`}</text>
          </g>
        )
      })}
    </svg>
  )
}

function headline(h: HabitStats): string {
  if (h.streak_days >= 14) return `🔥 ${h.streak_days} días seguidos haciendo hábitos. ¡Imparable!`
  if (h.streak_days >= 3) return `🔥 Llevas ${h.streak_days} días seguidos. No lo sueltes.`
  if (h.week_pct >= 80) return '💪 Semana increíble, vas arriba del 80%.'
  return 'Un día a la vez: hoy cuenta.'
}

function HabitsTab({ h }: { h: HabitStats | null }) {
  if (!h) return <Panel><p className="text-sm text-black/50 dark:text-white/50">Aún no tienes hábitos. Crea uno en Hábitos y aquí verás tu progreso.</p></Panel>
  return (
    <div className="space-y-4 sm:space-y-5">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">{headline(h)}</p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Kpi label="Racha actual" value={`${h.streak_days}`} sub="días seguidos" color={h.streak_days > 0 ? GREEN : undefined} />
        <Kpi label="Mejor racha" value={`${h.best_streak_days}`} sub="días (últimos 6 meses)" />
        <Kpi label="Esta semana" value={`${h.week_pct}%`} sub="de lo programado" />
        <Kpi label="Últimos 30 días" value={`${h.month_pct}%`} sub="cumplimiento" />
        <Kpi label="Días perfectos" value={`${h.perfect_days_30}`} sub="de 30, todos los hábitos" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5">
        <Panel title="Últimas 12 semanas" className="xl:col-span-3">
          <Heatmap cells={h.heatmap} />
          <p className="text-[11px] text-black/40 dark:text-white/40 mt-3">
            {h.best_weekday !== null && <>Tu mejor día es el <b className="text-black/70 dark:text-white/70">{WEEKDAYS[h.best_weekday]}</b>. </>}
            {h.worst_weekday !== null && h.worst_weekday !== h.best_weekday && <>El que más cuesta: <b className="text-black/70 dark:text-white/70">{WEEKDAYS[h.worst_weekday]}</b>.</>}
          </p>
        </Panel>
        <Panel title="Cumplimiento por semana" className="xl:col-span-2">
          <WeeklyBars weekly={h.weekly} />
        </Panel>
      </div>

      <Panel title="Por hábito">
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          {h.per_habit.map(p => (
            <div key={p.id} className="py-3 first:pt-0 last:pb-0 grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.4fr)_1fr_auto] gap-x-6 gap-y-2 items-center">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-sm font-medium truncate text-black dark:text-white">{p.name}</span>
              </div>
              <div className="text-right sm:order-3 text-xs text-black/50 dark:text-white/50 tabular-nums whitespace-nowrap">
                🔥 {p.streak} <span className="text-black/30 dark:text-white/30">· récord {p.best_streak}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:order-2 space-y-1">
                <div className="flex justify-between text-[11px] text-black/45 dark:text-white/45">
                  <span>Semana {p.week_pct}%</span><span>30 días {p.month_pct}%</span>
                </div>
                <Bar pct={p.month_pct} color={p.color} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ── Recordatorios y listas ────────────────────────────────────────────────────

function TasksTab({ s }: { s: Stats }) {
  const { reminders: r, lists: l } = s
  const msg = r.week.done > 0
    ? `✅ Esta semana cumpliste ${r.week.done} recordatorio${r.week.done === 1 ? '' : 's'}${l.checked_week ? ` y tachaste ${l.checked_week} de tus listas` : ''}.`
    : l.checked_week > 0 ? `📝 Esta semana tachaste ${l.checked_week} cosas de tus listas.` : 'Esta semana va tranquila: ¡a tachar algo!'

  return (
    <div className="space-y-4 sm:space-y-5">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">{msg}</p>

      <Panel title="Recordatorios">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Cumplidos esta semana" value={`${r.week.done}`} color={r.week.done > 0 ? GREEN : undefined} />
          <Kpi label="No cumplidos esta semana" value={`${r.week.missed}`} color={r.week.missed > 0 ? CORAL : undefined} />
          <Kpi label="Cumplidos · 30 días" value={`${r.month.done}`} sub={`${r.month.missed} sin cumplir`} />
          <Kpi label="Cumplimiento · 30 días" value={`${r.month.pct}%`} sub={r.overdue_now ? `${r.overdue_now} vencidos por hacer ahora` : 'Sin vencidos 🎉'} />
        </div>
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-[11px] text-black/45 dark:text-white/45"><span>Últimos 30 días</span><span>{r.month.done} de {r.month.done + r.month.missed}</span></div>
          <Bar pct={r.month.pct} color={GREEN} />
        </div>
      </Panel>

      <Panel title="Listas">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Tachados esta semana" value={`${l.checked_week}`} color={l.checked_week > 0 ? GREEN : undefined} />
          <Kpi label="Tachados · 30 días" value={`${l.checked_month}`} />
          <Kpi label="Pendientes" value={`${l.pending_items}`} sub={`de ${l.total_items} elementos`} />
          <Kpi label="Listas completas" value={`${l.lists_complete}`} sub={`de ${l.lists}`} />
        </div>
      </Panel>
    </div>
  )
}

// ── Finanzas ──────────────────────────────────────────────────────────────────

function CycleBars({ cycles }: { cycles: FinanceStats['cycles'] }) {
  const max = Math.max(1, ...cycles.flatMap(c => [c.income, c.spent]))
  const H = 120
  const colW = 70
  return (
    <svg viewBox={`0 0 ${cycles.length * colW} ${H + 34}`} className="w-full h-48 text-black dark:text-white">
      {cycles.map((c, i) => {
        const ih = (c.income / max) * H
        const sh = (c.spent / max) * H
        return (
          <g key={c.start} transform={`translate(${i * colW + 10},0)`} opacity={c.is_current ? 1 : 0.8}>
            <rect x="0" y={H - ih} width="22" height={ih} rx="5" fill="currentColor" opacity="0.14" />
            <rect x="26" y={H - sh} width="22" height={sh} rx="5" fill={CORAL} opacity="0.85" />
            <text x="24" y={H + 14} textAnchor="middle" fontSize="8.5" fill="currentColor" opacity={c.is_current ? 0.8 : 0.45} fontWeight={c.is_current ? 700 : 400}>{c.label.split(' – ')[0]}</text>
            <text x="24" y={H + 26} textAnchor="middle" fontSize="8.5" fill={c.net >= 0 ? GREEN : CORAL}>{c.spent > 0 ? `${c.net >= 0 ? '+' : '−'}${Math.abs(Math.round(c.net / 1000))}k` : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

function FinanceTab({ f }: { f: FinanceStats | null }) {
  if (!f) return <Panel><p className="text-sm text-black/50 dark:text-white/50">Configura tu ingreso mensual en Finanzas para ver tus ciclos.</p></Panel>
  const delta = f.spent_vs_prev_pct
  const maxCat = Math.max(1, ...f.categories.map(c => Math.max(c.amount, c.prev_amount)))
  return (
    <div className="space-y-4 sm:space-y-5">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">
        {delta === null ? 'Aún no hay un ciclo anterior con qué comparar.'
          : delta <= 0 ? `📉 Vas gastando ${Math.abs(delta)}% menos que en el ciclo pasado a estas alturas. ¡Bien!`
          : `📈 Vas gastando ${delta}% más que en el ciclo pasado a estas alturas.`}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Gastado este ciclo" value={money(f.spent_current)} />
        <Kpi label="Mismo punto, ciclo pasado" value={money(f.spent_prev_same_point)} />
        <Kpi label="Cambio" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`} color={delta === null ? undefined : delta > 0 ? CORAL : GREEN} />
        <Kpi label="Gasto diario promedio" value={money(f.avg_daily_spend)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <Panel title="Últimos 6 ciclos">
          <CycleBars cycles={f.cycles} />
          <div className="flex items-center gap-4 text-[11px] text-black/45 dark:text-white/45 mt-1">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-black/15 dark:bg-white/20" /> Ingreso</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: CORAL }} /> Gastado</span>
            <span>Debajo: lo que sobró</span>
          </div>
        </Panel>

        <Panel title="Categorías de este ciclo vs. el pasado">
          {f.categories.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">Sin gastos registrados todavía en este ciclo.</p>
          ) : (
            <div className="space-y-3">
              {f.categories.map(c => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span className="text-black dark:text-white">{c.category}</span>
                    <span className="tabular-nums text-black/70 dark:text-white/70">
                      {money(c.amount)}
                      {c.prev_amount > 0 && (
                        <span className="text-[11px] ml-2" style={{ color: c.amount > c.prev_amount ? CORAL : GREEN }}>
                          {c.amount > c.prev_amount ? '▲' : '▼'} {Math.abs(Math.round(((c.amount - c.prev_amount) / c.prev_amount) * 100))}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <Bar pct={(c.amount / maxCat) * 100} color={CORAL} />
                    <div className="h-1 rounded-full bg-black/20 dark:bg-white/25" style={{ width: `${(c.prev_amount / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-black/40 dark:text-white/40">Barra gris: el ciclo pasado hasta el mismo día.</p>
            </div>
          )}
        </Panel>
      </div>
      <p className="text-[11px] text-black/35 dark:text-white/35">No incluye transferencias ni la deuda arrastrada del ciclo anterior.</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EstadisticasPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tab, setTab] = useState<Tab>('habitos')
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    getStats().then(setStats).catch(() => setError(true))
  }, [])

  return (
    <AppLayout>
      <div className="max-w-5xl xl:max-w-[1400px] mx-auto pb-24 space-y-5">
        <div className="pt-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Estadísticas</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-0.5">Cómo vas con tus hábitos, tus pendientes y tu dinero</p>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'glass text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <Panel><p className="text-sm text-black/50 dark:text-white/50">No se pudieron cargar las estadísticas. Inténtalo de nuevo.</p></Panel>
        ) : !stats ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse bg-black/5 dark:bg-white/5" />)}</div>
        ) : tab === 'habitos' ? (
          <HabitsTab h={stats.habits} />
        ) : tab === 'tareas' ? (
          <TasksTab s={stats} />
        ) : (
          <FinanceTab f={stats.finance} />
        )}
      </div>
    </AppLayout>
  )
}
