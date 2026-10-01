'use client'

import { useMemo } from 'react'
import type { Expense } from '@/lib/types'

interface CyclePaceCardProps {
  expenses: Expense[]
  cycleStart: string
  cycleEnd: string
  cycleStartDay: number
  available: number
}

const ACCENT = '#6B46E5'
const CORAL = '#FF6B6B'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parse = (iso: string) => new Date(`${iso}T00:00:00`)

const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000)

// Transfers between accounts and savings withdrawals are not real spending.
const isRealSpend = (e: Expense) => e.payment_method !== 'savings' && e.category !== 'Transferencia'

export default function CyclePaceCard({ expenses, cycleStart, cycleEnd, cycleStartDay, available }: CyclePaceCardProps) {
  const m = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = parse(cycleStart)
    const end = parse(cycleEnd)

    const elapsed = Math.max(1, Math.min(daysBetween(start, today) + 1, daysBetween(start, end) + 1))
    const daysLeft = Math.max(1, daysBetween(today, end) + 1)

    // Cycle k back: same start day, k months earlier (clamped to month length)
    const cycleStartK = (k: number) => {
      const total = start.getFullYear() * 12 + start.getMonth() - k
      const y = Math.floor(total / 12)
      const mo = total % 12
      return new Date(y, mo, Math.min(cycleStartDay, new Date(y, mo + 1, 0).getDate()))
    }

    const sumRange = (from: Date, to: Date) => {
      const a = toISO(from)
      const b = toISO(to)
      return expenses
        .filter(e => isRealSpend(e) && e.date >= a && e.date <= b)
        .reduce((s, e) => s + Number(e.amount), 0)
    }

    const spent = sumRange(start, today)
    const prevStart = cycleStartK(1)
    const prevSpent = sumRange(prevStart, addDays(prevStart, elapsed - 1))

    const spendDays = new Set(
      expenses.filter(e => isRealSpend(e) && e.date >= toISO(start) && e.date <= toISO(today)).map(e => e.date)
    ).size

    // Expected spending for the rest of the cycle: what was spent in the same remaining
    // stretch of the last (up to 3) cycles that have data. Spending is lumpy, so a daily
    // average would badly overestimate.
    const samples: number[] = []
    for (let k = 1; k <= 3; k++) {
      const ks = cycleStartK(k)
      const ke = addDays(cycleStartK(k - 1), -1)
      if (sumRange(ks, ke) <= 0) continue
      samples.push(sumRange(addDays(ks, elapsed), ke))
    }
    const expectedRest = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : null
    const projectedClose = expectedRest === null ? null : available - expectedRest

    const allowed = available > 0 ? available / daysLeft : 0

    return { elapsed, daysLeft, spent, prevSpent, spendDays, allowed, expectedRest, projectedClose, sampleCount: samples.length }
  }, [expenses, cycleStart, cycleEnd, cycleStartDay, available])

  const over = available <= 0
  const delta = m.prevSpent > 0 ? ((m.spent - m.prevSpent) / m.prevSpent) * 100 : null
  const barMax = Math.max(m.spent, m.prevSpent, 1)

  return (
    <div className="space-y-4">
      <div>
        {over ? (
          <>
            <p className="text-3xl font-semibold tabular-nums" style={{ color: CORAL }}>Sin margen</p>
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">
              Vas {fmt(Math.abs(available))} en rojo · quedan {m.daysLeft} {m.daysLeft === 1 ? 'día' : 'días'} de ciclo
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold tabular-nums text-black dark:text-white">
              {fmt(m.allowed)}<span className="text-sm font-normal text-black/40 dark:text-white/40"> / día</span>
            </p>
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">
              Para no quedar en rojo · quedan {m.daysLeft} {m.daysLeft === 1 ? 'día' : 'días'} y {fmt(available)} disponibles
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
          <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Días con gasto</p>
          <p className="text-base font-semibold tabular-nums text-black dark:text-white">
            {m.spendDays}<span className="text-[10px] font-normal text-black/40 dark:text-white/40"> de {m.elapsed}</span>
          </p>
        </div>
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
          <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Cierre estimado</p>
          {m.projectedClose === null ? (
            <p className="text-xs text-black/40 dark:text-white/40">Sin historial aún</p>
          ) : (
            <>
              <p
                className={`text-base font-semibold tabular-nums ${m.projectedClose >= 0 ? 'text-emerald-500 dark:text-emerald-400' : ''}`}
                style={{ color: m.projectedClose < 0 ? CORAL : undefined }}
              >
                {fmt(m.projectedClose)}
              </p>
              <p className="text-[10px] text-black/30 dark:text-white/30 mt-0.5">
                si gastas como en {m.sampleCount === 1 ? 'el ciclo pasado' : `tus últimos ${m.sampleCount} ciclos`} (~{fmt(m.expectedRest ?? 0)})
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-black/50 dark:text-white/50">Gastado al día {m.elapsed} del ciclo</p>
          {delta !== null && (
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: delta > 0 ? CORAL : '#34d399' }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(0)}% vs ciclo anterior
            </span>
          )}
        </div>
        {([['Este ciclo', m.spent, ACCENT], ['Ciclo anterior', m.prevSpent, '#9ca3af']] as const).map(([label, value, color]) => (
          <div key={label} className="mb-2 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-black/40 dark:text-white/40">{label}</span>
              <span className="text-[11px] font-semibold tabular-nums text-black/70 dark:text-white/70">{fmt(value)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / barMax) * 100)}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
        <p className="text-[10px] text-black/30 dark:text-white/30 mt-2">No cuenta transferencias ni retiros de ahorro.</p>
      </div>
    </div>
  )
}
