'use client'

import { useState, useRef } from 'react'
import type { Expense } from '@/lib/types'

interface CategorySpendingChartProps {
  expenses: Expense[]
  cycleStart: string
  cycleEnd: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export default function CategorySpendingChart({ expenses, cycleStart, cycleEnd }: CategorySpendingChartProps) {
  const [tooltip, setTooltip] = useState<{ name: string; amount: number; mx: number; my: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const cycleExpenses = expenses.filter(e => e.date >= cycleStart && e.date <= cycleEnd)

  const map = new Map<string, number>()
  for (const e of cycleExpenses) {
    const cat = e.category?.trim() || 'Sin categoría'
    map.set(cat, (map.get(cat) ?? 0) + Number(e.amount))
  }

  if (map.size === 0) return null

  const rows = Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const max = rows[0].amount
  const BAR_HEIGHT = 22
  const GAP = 10
  const LABEL_WIDTH = 108
  const BAR_MAX_WIDTH = 300
  const chartH = rows.length * (BAR_HEIGHT + GAP) - GAP

  function handleBarEnter(e: React.MouseEvent, row: { name: string; amount: number }) {
    const rect = containerRef.current!.getBoundingClientRect()
    setTooltip({ name: row.name, amount: row.amount, mx: e.clientX - rect.left, my: e.clientY - rect.top })
  }

  function handleBarMove(e: React.MouseEvent) {
    if (!tooltip) return
    const rect = containerRef.current!.getBoundingClientRect()
    setTooltip(t => t ? { ...t, mx: e.clientX - rect.left, my: e.clientY - rect.top } : null)
  }

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        width="100%"
        viewBox={`0 0 ${LABEL_WIDTH + BAR_MAX_WIDTH + 4} ${chartH}`}
        className="overflow-visible"
      >
        {rows.map((row, i) => {
          const barW = Math.max(6, (row.amount / max) * BAR_MAX_WIDTH)
          const y = i * (BAR_HEIGHT + GAP)
          const barX = LABEL_WIDTH

          return (
            <g key={row.name}>
              {/* Category label */}
              <text
                x={LABEL_WIDTH - 10}
                y={y + BAR_HEIGHT / 2 + 4}
                textAnchor="end"
                className="fill-black/50 dark:fill-white/40"
                style={{ fontSize: 11, fontFamily: 'inherit' }}
              >
                {row.name.length > 14 ? row.name.slice(0, 13) + '…' : row.name}
              </text>

              {/* Bar track (subtle background) */}
              <rect
                x={barX}
                y={y + 4}
                width={BAR_MAX_WIDTH}
                height={BAR_HEIGHT - 8}
                rx={4}
                className="fill-black/[0.04] dark:fill-white/[0.04]"
              />

              {/* Bar fill — 4px rounded data-end, square at baseline per spec */}
              <rect
                x={barX}
                y={y + 4}
                width={barW}
                height={BAR_HEIGHT - 8}
                rx={4}
                className="fill-[#6B46E5] dark:fill-[#AF9BFF] opacity-75 transition-opacity cursor-pointer"
                onMouseEnter={e => handleBarEnter(e, row)}
                onMouseMove={handleBarMove}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* Value label at bar tip — shown outside if bar is long enough */}
              {barW > 60 && (
                <text
                  x={barX + barW - 6}
                  y={y + BAR_HEIGHT / 2 + 4}
                  textAnchor="end"
                  className="fill-white/80 dark:fill-black/70"
                  style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 600 }}
                >
                  {fmt(row.amount)}
                </text>
              )}
              {barW <= 60 && (
                <text
                  x={barX + barW + 6}
                  y={y + BAR_HEIGHT / 2 + 4}
                  textAnchor="start"
                  className="fill-black/40 dark:fill-white/30"
                  style={{ fontSize: 10, fontFamily: 'inherit' }}
                >
                  {fmt(row.amount)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 bg-white dark:bg-[#1C1C1C] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 shadow-lg text-xs whitespace-nowrap"
          style={{ left: tooltip.mx, top: tooltip.my, transform: 'translate(-50%, -120%)' }}
        >
          <p className="font-semibold text-black dark:text-white">{tooltip.name}</p>
          <p className="text-[#6B46E5] dark:text-[#AF9BFF] font-bold mt-0.5">{fmt(tooltip.amount)}</p>
        </div>
      )}
    </div>
  )
}
