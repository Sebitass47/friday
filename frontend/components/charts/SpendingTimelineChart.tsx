'use client'

import { useState, useMemo } from 'react'
import type { Expense } from '@/lib/types'
import { useTheme } from '@/components/ThemeProvider'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
}

interface Props {
  expenses: Expense[]
  monthlyIncome: number
}

export default function SpendingTimelineChart({ expenses, monthlyIncome }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const coral = '#FF6B6B'
  const accent = isDark ? '#AF9BFF' : '#6B46E5'
  const amber = '#F59E0B'

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthExpenses = useMemo(() =>
    expenses
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00')
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    [expenses, viewMonth, viewYear])

  // Group expenses by day
  type DayData = { total: number; items: Expense[] }
  const byDay = useMemo(() => {
    const map: Record<number, DayData> = {}
    for (const e of monthExpenses) {
      const day = new Date(e.date + 'T00:00:00').getDate()
      if (!map[day]) map[day] = { total: 0, items: [] }
      map[day].total += Number(e.amount)
      map[day].items.push(e)
    }
    return map
  }, [monthExpenses])

  const totalSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const hasIncome = monthlyIncome > 0

  // Build running balance for the step-line
  const endDay = isCurrentMonth ? today.getDate() : daysInMonth
  let running = hasIncome ? monthlyIncome : 0
  const balanceByDay: number[] = Array(daysInMonth + 1).fill(running)
  for (let d = 1; d <= daysInMonth; d++) {
    if (byDay[d]) running -= byDay[d].total
    for (let dd = d; dd <= daysInMonth; dd++) balanceByDay[dd] = running
  }

  // SVG viewport
  const W = 600
  const H = 170
  const PL = 4, PR = 4, PT = 20, PB = 22

  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const xOf = (day: number) => PL + ((day - 0.5) / daysInMonth) * chartW
  const maxDot = useMemo(() => Math.max(...Object.values(byDay).map(d => d.total), 1), [byDay])

  // For Y axis: if income set use running balance, else use cumulative spending
  const yMin = hasIncome ? Math.min(...balanceByDay.slice(1, endDay + 1), 0) : 0
  const yMax = hasIncome ? monthlyIncome : Math.max(totalSpent, 1)
  const yRange = yMax - yMin || 1

  const yOf = (val: number) => PT + ((yMax - val) / yRange) * chartH

  // Build the step-line path
  let pathD = `M ${PL} ${yOf(hasIncome ? monthlyIncome : 0)}`
  let bal = hasIncome ? monthlyIncome : 0
  for (let d = 1; d <= endDay; d++) {
    const drop = byDay[d]?.total ?? 0
    pathD += ` L ${xOf(d)} ${yOf(bal)}`
    if (drop) {
      pathD += ` L ${xOf(d)} ${yOf(bal - drop)}`
      bal -= drop
    }
  }
  pathD += ` L ${xOf(endDay)} ${yOf(bal)}`

  const areaD = `${pathD} L ${xOf(endDay)} ${yOf(yMin)} L ${PL} ${yOf(yMin)} Z`

  const textFill = isDark ? 'rgba(255,255,255,OPACITY)' : 'rgba(0,0,0,OPACITY)'
  const tf = (op: number) => textFill.replace('OPACITY', String(op))
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  const daysWithExpenses = Object.keys(byDay).map(Number).sort((a, b) => a - b)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
          >
            ‹
          </button>
          <span className="text-xs font-medium text-black/50 dark:text-white/50 w-32 text-center">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-20 text-sm"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3">
          {hasIncome && (
            <div className="text-right">
              <p className="text-[9px] text-black/25 dark:text-white/25">Disponible</p>
              <p className={`text-xs font-semibold tabular-nums ${bal < 0 ? 'text-[#FF6B6B]' : 'text-emerald-500 dark:text-emerald-400'}`}>{fmt(bal)}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-[9px] text-black/25 dark:text-white/25">Gastado</p>
            <p className="text-xs font-semibold text-[#FF6B6B] tabular-nums">{fmt(totalSpent)}</p>
          </div>
        </div>
      </div>

      {daysWithExpenses.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center">
          <p className="text-xs text-black/20 dark:text-white/20">Sin gastos registrados</p>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: '160px' }}>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map(t => (
              <line key={t}
                x1={PL} y1={PT + t * chartH}
                x2={W - PR} y2={PT + t * chartH}
                stroke={gridStroke} strokeWidth="1"
              />
            ))}

            {/* Zero line */}
            {hasIncome && yMin < 0 && (
              <line x1={PL} y1={yOf(0)} x2={W - PR} y2={yOf(0)}
                stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                strokeWidth="1" strokeDasharray="4,3"
              />
            )}

            {/* Area fill */}
            <path d={areaD} fill={coral} opacity="0.04" />

            {/* Step line */}
            <path d={pathD} fill="none" stroke={coral} strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.5"
            />

            {/* Today marker */}
            {isCurrentMonth && (
              <line
                x1={xOf(today.getDate())} y1={PT}
                x2={xOf(today.getDate())} y2={H - PB}
                stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
                strokeWidth="1" strokeDasharray="3,3"
              />
            )}

            {/* Expense dots */}
            {daysWithExpenses.map(day => {
              const data = byDay[day]
              let balBefore = hasIncome ? monthlyIncome : 0
              for (let d = 1; d < day; d++) balBefore -= byDay[d]?.total ?? 0
              const balAfter = balBefore - data.total
              const isHov = hoveredDay === day
              const r = Math.min(11, Math.max(4.5, Math.sqrt(data.total / maxDot) * 13))
              const dotY = yOf(hasIncome ? balAfter : data.total)
              const cx = xOf(day)

              return (
                <g key={day}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Invisible hit area */}
                  <circle cx={cx} cy={dotY} r={Math.max(r, 10)} fill="transparent" />

                  {/* Dot ring */}
                  {isHov && <circle cx={cx} cy={dotY} r={r + 4} fill="none" stroke={coral} strokeWidth="1" opacity="0.3" />}

                  {/* Main dot */}
                  <circle cx={cx} cy={dotY} r={isHov ? r + 1.5 : r}
                    fill={coral} opacity={isHov ? 1 : 0.7}
                  />

                  {/* Tooltip */}
                  {isHov && (() => {
                    const maxItems = 5
                    const shown = data.items.slice(0, maxItems)
                    const more = data.items.length - maxItems
                    const lineH = 13
                    const tooltipH = 22 + shown.length * lineH + (more > 0 ? lineH : 0)
                    const tooltipW = 160
                    const rawX = cx - tooltipW / 2
                    const tooltipX = Math.min(Math.max(rawX, PL), W - PR - tooltipW)
                    const above = dotY > H / 2
                    const tooltipY = above ? dotY - r - 6 - tooltipH : dotY + r + 6

                    return (
                      <g>
                        <rect
                          x={tooltipX} y={tooltipY}
                          width={tooltipW} height={tooltipH}
                          rx="8"
                          fill={isDark ? '#1C1C1E' : '#FFFFFF'}
                          stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                          strokeWidth="1"
                          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
                        />
                        {/* Day + total */}
                        <text x={tooltipX + 10} y={tooltipY + 14} fontSize="9.5" fontWeight="700" fill={coral}>
                          {`Día ${day}  `}
                          <tspan fill={tf(0.9)}>{fmt(data.total)}</tspan>
                        </text>
                        {/* Individual expenses */}
                        {shown.map((item, j) => (
                          <text key={j} x={tooltipX + 10} y={tooltipY + 14 + (j + 1) * lineH + 4}
                            fontSize="8.5" fill={tf(0.45)}
                          >
                            {`${item.name.length > 16 ? item.name.slice(0, 15) + '…' : item.name}  `}
                            <tspan fontWeight="600" fill={tf(0.7)}>−{fmt(Number(item.amount))}</tspan>
                          </text>
                        ))}
                        {more > 0 && (
                          <text x={tooltipX + 10} y={tooltipY + 14 + (shown.length + 1) * lineH + 4}
                            fontSize="8" fill={tf(0.25)}
                          >
                            +{more} más…
                          </text>
                        )}
                      </g>
                    )
                  })()}
                </g>
              )
            })}

            {/* Axis labels */}
            {[1, Math.round(daysInMonth / 2), daysInMonth].map(d => (
              <text key={d} x={xOf(d)} y={H - 6} fontSize="8"
                fill={tf(0.22)} textAnchor="middle"
              >
                {d}
              </text>
            ))}

            {/* Y axis labels */}
            {hasIncome && (
              <>
                <text x={PL + 2} y={PT + 9} fontSize="8" fill={tf(0.2)}>{fmt(yMax)}</text>
                {yMin < 0 && <text x={PL + 2} y={H - PB - 2} fontSize="8" fill="rgba(255,107,107,0.4)">{fmt(yMin)}</text>}
              </>
            )}
          </svg>
        </div>
      )}

      {/* Legend dots */}
      {daysWithExpenses.length > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <div className="h-2 w-2 rounded-full bg-[#FF6B6B] opacity-70" />
          <span className="text-[9px] text-black/25 dark:text-white/25">Cada punto = un día con gastos · tamaño según monto</span>
        </div>
      )}
    </div>
  )
}
