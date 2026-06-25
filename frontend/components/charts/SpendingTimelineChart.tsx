'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Expense } from '@/lib/types'
import { useTheme } from '@/components/ThemeProvider'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const fmtShort = (d: Date) =>
  d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

const STORAGE_KEY = 'friday_cycle_start_day'

// ── Period helpers ────────────────────────────────────────────────────────────

interface Period {
  start: Date   // inclusive
  end: Date     // inclusive (= start + 30ish days - 1)
  label: string
}

function buildPeriod(year: number, month: number, startDay: number): Period {
  const start = new Date(year, month, startDay)
  // end = one day before the same startDay next month
  const end = new Date(year, month + 1, startDay - 1)
  return {
    start,
    end,
    label: startDay === 1
      ? start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      : `${fmtShort(start)} – ${fmtShort(end)}`,
  }
}

function periodContaining(date: Date, startDay: number): Period {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  if (d >= startDay) return buildPeriod(y, m, startDay)
  // date is before startDay → belongs to the period that started last month
  const prevM = m === 0 ? 11 : m - 1
  const prevY = m === 0 ? y - 1 : y
  return buildPeriod(prevY, prevM, startDay)
}

function prevPeriod(p: Period, startDay: number): Period {
  const prevStart = new Date(p.start)
  prevStart.setMonth(prevStart.getMonth() - 1)
  return buildPeriod(prevStart.getFullYear(), prevStart.getMonth(), startDay)
}

function nextPeriod(p: Period, startDay: number): Period {
  const nextStart = new Date(p.start)
  nextStart.setMonth(nextStart.getMonth() + 1)
  return buildPeriod(nextStart.getFullYear(), nextStart.getMonth(), startDay)
}

function isCurrentPeriod(p: Period): boolean {
  const now = new Date()
  return now >= p.start && now <= p.end
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  expenses: Expense[]
  monthlyIncome: number
}

export default function SpendingTimelineChart({ expenses, monthlyIncome }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const coral = '#FF6B6B'

  const [cycleStartDay, setCycleStartDay] = useState(1)
  const [editingCycle, setEditingCycle] = useState(false)
  const [cycleInput, setCycleInput] = useState('1')
  const cycleRef = useRef<HTMLInputElement>(null)

  // Load from localStorage once
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const d = parseInt(stored, 10)
      if (d >= 1 && d <= 28) { setCycleStartDay(d); setCycleInput(String(d)) }
    }
  }, [])

  const today = new Date()
  const [period, setPeriod] = useState<Period>(() => periodContaining(today, 1))

  // When cycleStartDay changes, jump to the period containing today
  useEffect(() => {
    setPeriod(periodContaining(today, cycleStartDay))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleStartDay])

  function saveCycleDay() {
    const d = parseInt(cycleInput, 10)
    if (isNaN(d) || d < 1 || d > 28) return
    setCycleStartDay(d)
    localStorage.setItem(STORAGE_KEY, String(d))
    setEditingCycle(false)
  }

  function goBack() { setPeriod(p => prevPeriod(p, cycleStartDay)) }
  function goNext() {
    if (isCurrentPeriod(period)) return
    setPeriod(p => nextPeriod(p, cycleStartDay))
  }

  const isCurrent = isCurrentPeriod(period)
  const periodDays = daysBetween(period.start, period.end) + 1

  // Filter expenses within this period
  const periodExpenses = useMemo(() =>
    expenses
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00')
        return d >= period.start && d <= period.end
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    [expenses, period])

  // Group by offset day within period
  type DayData = { total: number; items: Expense[]; date: Date }
  const byOffset = useMemo(() => {
    const map: Record<number, DayData> = {}
    for (const e of periodExpenses) {
      const d = new Date(e.date + 'T00:00:00')
      const offset = daysBetween(period.start, d)
      if (!map[offset]) map[offset] = { total: 0, items: [], date: d }
      map[offset].total += Number(e.amount)
      map[offset].items.push(e)
    }
    return map
  }, [periodExpenses, period])

  const totalSpent = periodExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const hasIncome = monthlyIncome > 0

  // Running balance per offset
  let runBal = hasIncome ? monthlyIncome : 0
  const todayOffset = isCurrent ? Math.min(daysBetween(period.start, today), periodDays - 1) : periodDays - 1

  // Build step-line
  let pathD = ''
  let bal = hasIncome ? monthlyIncome : 0
  const drops: { offset: number; before: number; after: number; data: DayData }[] = []

  for (let i = 0; i < periodDays; i++) {
    const drop = byOffset[i]?.total ?? 0
    if (drop) {
      drops.push({ offset: i, before: bal, after: bal - drop, data: byOffset[i] })
      bal -= drop
    }
  }

  // SVG
  const W = 600, H = 170
  const PL = 4, PR = 4, PT = 20, PB = 22
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const xOf = (offset: number) => PL + ((offset + 0.5) / periodDays) * chartW

  const allBals = [hasIncome ? monthlyIncome : 0, ...drops.map(d => d.after)]
  const yMax = hasIncome ? monthlyIncome : Math.max(...drops.map(d => d.data.total), 1)
  const yMin = Math.min(...allBals, 0)
  const yRange = yMax - yMin || 1
  const yOf = (v: number) => PT + ((yMax - v) / yRange) * chartH

  const maxDot = Math.max(...drops.map(d => d.data.total), 1)

  if (drops.length > 0) {
    pathD = `M ${PL} ${yOf(hasIncome ? monthlyIncome : 0)}`
    let pb = hasIncome ? monthlyIncome : 0
    for (const { offset, before, after } of drops) {
      pathD += ` L ${xOf(offset)} ${yOf(before)} L ${xOf(offset)} ${yOf(after)}`
      pb = after
    }
    pathD += ` L ${xOf(todayOffset)} ${yOf(pb)}`
  }

  const areaD = drops.length > 0
    ? `${pathD} L ${xOf(todayOffset)} ${yOf(yMin)} L ${PL} ${yOf(yMin)} Z`
    : ''

  const tf = (op: number) => isDark ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`
  const gridS = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)

  // Month boundary lines within the period (when period spans 2 calendar months)
  const boundaryOffsets: number[] = []
  if (cycleStartDay > 1) {
    for (let i = 1; i < periodDays; i++) {
      const d = new Date(period.start)
      d.setDate(d.getDate() + i)
      if (d.getDate() === 1) boundaryOffsets.push(i)
    }
  }

  // X-axis tick labels: start, boundary(ies), end
  const xLabels: { offset: number; label: string }[] = [
    { offset: 0, label: String(period.start.getDate()) },
    ...boundaryOffsets.map(o => {
      const d = new Date(period.start); d.setDate(d.getDate() + o)
      return { offset: o, label: `1 ${d.toLocaleDateString('es-MX', { month: 'short' })}` }
    }),
    { offset: periodDays - 1, label: String(period.end.getDate()) },
  ]

  const finalBal = drops.reduce((b, d) => b - d.data.total, hasIncome ? monthlyIncome : 0)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button onClick={goBack} className="w-6 h-6 flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm">‹</button>
          <span className="text-[11px] font-medium text-black/50 dark:text-white/50 min-w-[120px] text-center">{period.label}</span>
          <button onClick={goNext} disabled={isCurrent} className="w-6 h-6 flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-20 text-sm">›</button>
        </div>

        <div className="flex items-center gap-3">
          {/* Cycle start day setting */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-black/25 dark:text-white/25">Ciclo desde día</span>
            {editingCycle ? (
              <input
                ref={cycleRef}
                type="number"
                min={1}
                max={28}
                value={cycleInput}
                onChange={e => setCycleInput(e.target.value)}
                onBlur={saveCycleDay}
                onKeyDown={e => { if (e.key === 'Enter') saveCycleDay(); if (e.key === 'Escape') setEditingCycle(false) }}
                className="w-10 text-[10px] text-center rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] text-black dark:text-white outline-none focus:border-[#6B46E5] dark:focus:border-[#AF9BFF] px-1 py-0.5"
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setEditingCycle(true); setCycleInput(String(cycleStartDay)) }}
                className="text-[10px] font-semibold text-[#6B46E5] dark:text-[#AF9BFF] hover:opacity-70 transition-opacity tabular-nums"
              >
                {cycleStartDay}
              </button>
            )}
          </div>

          {hasIncome && (
            <div className="text-right">
              <p className="text-[9px] text-black/25 dark:text-white/25">Disponible</p>
              <p className={`text-xs font-semibold tabular-nums ${finalBal < 0 ? 'text-[#FF6B6B]' : 'text-emerald-500 dark:text-emerald-400'}`}>{fmt(finalBal)}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-[9px] text-black/25 dark:text-white/25">Gastado</p>
            <p className="text-xs font-semibold text-[#FF6B6B] tabular-nums">{fmt(totalSpent)}</p>
          </div>
        </div>
      </div>

      {drops.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center">
          <p className="text-xs text-black/20 dark:text-white/20">Sin gastos registrados en este período</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: '155px' }}>
          {/* Grid */}
          {[0.25, 0.5, 0.75].map(t => (
            <line key={t} x1={PL} y1={PT + t * chartH} x2={W - PR} y2={PT + t * chartH} stroke={gridS} strokeWidth="1" />
          ))}

          {/* Zero line */}
          {hasIncome && yMin < 0 && (
            <line x1={PL} y1={yOf(0)} x2={W - PR} y2={yOf(0)} stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" strokeDasharray="4,3" />
          )}

          {/* Calendar month boundary */}
          {boundaryOffsets.map(o => (
            <line key={o} x1={xOf(o)} y1={PT} x2={xOf(o)} y2={H - PB} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" strokeDasharray="2,4" />
          ))}

          {/* Area */}
          {areaD && <path d={areaD} fill={coral} opacity="0.04" />}

          {/* Step line */}
          <path d={pathD} fill="none" stroke={coral} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />

          {/* Today marker */}
          {isCurrent && (
            <line x1={xOf(todayOffset)} y1={PT} x2={xOf(todayOffset)} y2={H - PB} stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} strokeWidth="1" strokeDasharray="3,3" />
          )}

          {/* Dots */}
          {drops.map(({ offset, after, data }) => {
            const cx = xOf(offset)
            const dotY = yOf(hasIncome ? after : data.total)
            const r = Math.min(11, Math.max(4.5, Math.sqrt(data.total / maxDot) * 13))
            const isHov = hoveredOffset === offset

            return (
              <g key={offset}
                onMouseEnter={() => setHoveredOffset(offset)}
                onMouseLeave={() => setHoveredOffset(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={cx} cy={dotY} r={Math.max(r, 10)} fill="transparent" />
                {isHov && <circle cx={cx} cy={dotY} r={r + 4} fill="none" stroke={coral} strokeWidth="1" opacity="0.3" />}
                <circle cx={cx} cy={dotY} r={isHov ? r + 1.5 : r} fill={coral} opacity={isHov ? 1 : 0.7} />

                {isHov && (() => {
                  const shown = data.items.slice(0, 5)
                  const more = data.items.length - shown.length
                  const lineH = 13
                  const tooltipH = 22 + shown.length * lineH + (more > 0 ? lineH : 0)
                  const tooltipW = 170
                  const tooltipX = Math.min(Math.max(cx - tooltipW / 2, PL), W - PR - tooltipW)
                  const above = dotY > H / 2
                  const tooltipY = above ? dotY - r - 6 - tooltipH : dotY + r + 6

                  return (
                    <g>
                      <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="8"
                        fill={isDark ? '#1C1C1E' : '#FFFFFF'}
                        stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                        strokeWidth="1"
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
                      />
                      <text x={tooltipX + 10} y={tooltipY + 14} fontSize="9.5" fontWeight="700" fill={coral}>
                        {fmtShort(data.date)}{'  '}
                        <tspan fill={tf(0.9)}>{fmt(data.total)}</tspan>
                      </text>
                      {shown.map((item, j) => (
                        <text key={j} x={tooltipX + 10} y={tooltipY + 14 + (j + 1) * lineH + 4} fontSize="8.5" fill={tf(0.45)}>
                          {`${item.name.length > 17 ? item.name.slice(0, 16) + '…' : item.name}  `}
                          <tspan fontWeight="600" fill={tf(0.7)}>−{fmt(Number(item.amount))}</tspan>
                        </text>
                      ))}
                      {more > 0 && (
                        <text x={tooltipX + 10} y={tooltipY + 14 + (shown.length + 1) * lineH + 4} fontSize="8" fill={tf(0.25)}>+{more} más…</text>
                      )}
                    </g>
                  )
                })()}
              </g>
            )
          })}

          {/* X-axis labels */}
          {xLabels.map(({ offset, label }) => (
            <text key={offset} x={xOf(offset)} y={H - 6} fontSize="8" fill={tf(0.22)} textAnchor="middle">{label}</text>
          ))}

          {/* Y-axis labels */}
          {hasIncome && (
            <>
              <text x={PL + 2} y={PT + 9} fontSize="8" fill={tf(0.18)}>{fmt(yMax)}</text>
              {yMin < 0 && <text x={PL + 2} y={H - PB - 3} fontSize="8" fill="rgba(255,107,107,0.4)">{fmt(yMin)}</text>}
            </>
          )}
        </svg>
      )}

      {drops.length > 0 && (
        <div className="flex items-center gap-1 mt-0.5">
          <div className="h-2 w-2 rounded-full bg-[#FF6B6B] opacity-70" />
          <span className="text-[9px] text-black/25 dark:text-white/25">Cada punto = día con gastos · tamaño según monto</span>
        </div>
      )}
    </div>
  )
}
