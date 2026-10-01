'use client'

import { useMemo, useRef, useState } from 'react'
import type { Expense, Income, MonthProjection } from '@/lib/types'

interface BalanceFlowChartProps {
  cycle: MonthProjection
  expenses: Expense[]
  // Point incomes that count toward "disponible" (already filtered by account type)
  incomes: Income[]
}

const CORAL = '#FF6B6B'
const GREEN = '#34d399'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parse = (iso: string) => new Date(`${iso}T00:00:00`)

const fmtDay = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

// Monotone cubic interpolation (no overshoot between jumps) -> SVG path
function smoothPath(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i])
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = Math.hypot(a, b)
    if (h > 3) { t[i] = (3 * a / h) * m[i]; t[i + 1] = (3 * b / h) * m[i] }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i][0] + dx[i] / 3
    const c1y = pts[i][1] + (t[i] * dx[i]) / 3
    const c2x = pts[i + 1][0] - dx[i] / 3
    const c2y = pts[i + 1][1] - (t[i + 1] * dx[i]) / 3
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

const W = 600
const H = 170
const PAD_T = 10
const PAD_B = 10

export default function BalanceFlowChart({ cycle, expenses, incomes }: BalanceFlowChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const d = useMemo(() => {
    const start = parse(cycle.cycle_start)
    const end = parse(cycle.cycle_end)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const elapsed = Math.max(1, Math.min(Math.round((today.getTime() - start.getTime()) / 86400000) + 1, totalDays))

    const startBalance =
      Number(cycle.income) - Number(cycle.recurring_expenses) - Number(cycle.installments) - Number(cycle.savings_contributions)

    const delta = new Array<number>(elapsed).fill(0)
    const dayIndex = (iso: string) => {
      const idx = Math.round((parse(iso).getTime() - start.getTime()) / 86400000)
      return Math.max(0, idx) // purchases before the cycle start (credit statement) land on day 0
    }

    let incomeTotal = 0
    let expenseTotal = 0

    for (const i of incomes) {
      if (i.date < cycle.cycle_start || i.date > toISO(today)) continue
      const amt = Number(i.amount)
      delta[Math.min(dayIndex(i.date), elapsed - 1)] += amt
      incomeTotal += amt
    }

    const endMonth = end.getMonth() + 1
    const endYear = end.getFullYear()
    for (const e of expenses) {
      let counts = false
      if (e.payment_method === 'cash' || e.payment_method === 'debit') {
        counts = e.date >= cycle.cycle_start && e.date <= toISO(today)
      } else if (e.payment_method === 'credit') {
        counts = e.credit_statement_month === endMonth && e.credit_statement_year === endYear
      }
      if (!counts) continue
      const amt = Number(e.amount)
      delta[Math.min(dayIndex(e.date), elapsed - 1)] -= amt
      expenseTotal += amt
    }

    const values: number[] = []
    let run = startBalance
    for (let k = 0; k < elapsed; k++) {
      run += delta[k]
      values.push(run)
    }
    // Day 0 point = balance at the very start, before any movement
    const series = [startBalance, ...values]
    return { start, totalDays, elapsed, startBalance, series, incomeTotal, expenseTotal }
  }, [cycle, expenses, incomes])

  const { series, startBalance } = d
  const current = series[series.length - 1]

  const geo = useMemo(() => {
    const min = Math.min(...series, 0)
    const max = Math.max(...series, 0)
    const span = max - min || 1
    const y = (v: number) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B)
    // series[0] = start of day 1, series[k] = end of day k. x spans the full cycle.
    const x = (k: number) => (k / d.totalDays) * W
    const pts = series.map((v, k) => [x(k), y(v)] as [number, number])
    const line = smoothPath(pts)
    const last = pts[pts.length - 1]
    const area = `${line} L${last[0]},${H} L${pts[0][0]},${H} Z`
    return { x, y, pts, line, area, last, zeroY: y(0), showZero: min < 0 }
  }, [series, d.totalDays])

  const negative = current < 0
  const shown = hoverIdx === null ? current : series[hoverIdx]
  const shownLabel =
    hoverIdx === null ? 'Disponible hoy' : hoverIdx === 0 ? 'Inicio del ciclo' : fmtDay(new Date(d.start.getTime() + (hoverIdx - 1) * 86400000))
  const pct = startBalance !== 0 ? ((shown - startBalance) / Math.abs(startBalance)) * 100 : 0
  const gid = 'balflow'

  function onMove(clientX: number) {
    const el = svgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = ((clientX - r.left) / r.width) * W
    let best = 0
    let bestDist = Infinity
    geo.pts.forEach(([ptx], k) => {
      const dist = Math.abs(ptx - px)
      if (dist < bestDist) { bestDist = dist; best = k }
    })
    setHoverIdx(best)
  }

  const hoverPt = hoverIdx === null ? geo.last : geo.pts[hoverIdx]
  const tone = negative ? CORAL : undefined

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 dark:text-white/40">{shownLabel}</p>
      <div className="flex items-end gap-3 mt-1">
        <p className="text-3xl font-semibold tabular-nums text-black dark:text-white" style={{ color: shown < 0 ? CORAL : undefined }}>
          {fmt(shown)}
        </p>
        <span
          className="mb-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums"
          style={{
            color: pct < 0 ? CORAL : GREEN,
            backgroundColor: pct < 0 ? 'rgba(255,107,107,0.12)' : 'rgba(52,211,153,0.12)',
          }}
        >
          {pct > 0 ? '+' : ''}{pct.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center gap-4 mt-2 text-[11px] text-black/50 dark:text-white/50">
        <span>Inicio <span className="font-semibold tabular-nums text-black/80 dark:text-white/80">{fmt(startBalance)}</span></span>
        <span style={{ color: GREEN }}>↑ {fmt(d.incomeTotal)}</span>
        <span style={{ color: CORAL }}>↓ {fmt(d.expenseTotal)}</span>
      </div>

      <div className="relative mt-4 select-none touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-40 overflow-visible text-black dark:text-white"
          style={{ color: tone }}
          onMouseMove={e => onMove(e.clientX)}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={e => onMove(e.touches[0].clientX)}
          onTouchMove={e => onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.showZero && (
            <line x1="0" x2={W} y1={geo.zeroY} y2={geo.zeroY} stroke="currentColor" strokeOpacity="0.18" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          )}
          <path d={geo.area} fill={`url(#${gid})`} />
          <path d={geo.line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hoverIdx !== null && (
            <line x1={hoverPt[0]} x2={hoverPt[0]} y1="0" y2={H} stroke="currentColor" strokeOpacity="0.2" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Marker as HTML so it stays round despite the stretched viewBox */}
        <span
          className="absolute w-2.5 h-2.5 rounded-full bg-black dark:bg-white pointer-events-none -translate-x-1/2 -translate-y-1/2 ring-4 ring-black/10 dark:ring-white/10"
          style={{
            left: `${(hoverPt[0] / W) * 100}%`,
            top: `${(hoverPt[1] / H) * 100}%`,
            backgroundColor: tone,
          }}
        />
      </div>

      <div className="flex justify-between mt-2 text-[10px] text-black/30 dark:text-white/30">
        <span>{fmtDay(d.start)}</span>
        <span>{fmtDay(new Date(d.start.getTime() + (d.totalDays - 1) * 86400000))}</span>
      </div>
    </div>
  )
}
