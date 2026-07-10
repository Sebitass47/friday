'use client'

import { useState, useRef } from 'react'
import type { Expense } from '@/lib/types'

interface CategorySpendingChartProps {
  expenses: Expense[]
  cycleStart: string
  cycleEnd: string
  onCategoryClick?: (category: string, expenses: Expense[]) => void
}

const PALETTE = [
  '#818CF8', // indigo
  '#34D399', // emerald
  '#F472B6', // pink
  '#FBBF24', // amber
  '#22D3EE', // cyan
  '#A78BFA', // violet
  '#F87171', // red
  '#4ADE80', // green
  '#FB923C', // orange
  '#38BDF8', // sky
]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export default function CategorySpendingChart({ expenses, cycleStart, cycleEnd, onCategoryClick }: CategorySpendingChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const cycleExpenses = expenses.filter(e => e.date >= cycleStart && e.date <= cycleEnd)

  const map = new Map<string, { amount: number; items: Expense[] }>()
  for (const e of cycleExpenses) {
    const cat = e.category?.trim() || 'Sin categoría'
    const prev = map.get(cat) ?? { amount: 0, items: [] }
    map.set(cat, { amount: prev.amount + Number(e.amount), items: [...prev.items, e] })
  }

  if (map.size === 0) return null

  const rows = Array.from(map.entries())
    .map(([name, { amount, items }]) => ({ name, amount, items }))
    .sort((a, b) => b.amount - a.amount)

  const max = rows[0].amount
  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const pct = Math.max(4, (row.amount / max) * 100)
        const color = PALETTE[i % PALETTE.length]
        const isHovered = hovered === row.name
        return (
          <div
            key={row.name}
            className="group cursor-pointer"
            onMouseEnter={() => setHovered(row.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onCategoryClick?.(row.name, row.items)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-black/50 dark:text-white/50 truncate max-w-[140px]">{row.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-black/30 dark:text-white/30">{((row.amount / total) * 100).toFixed(0)}%</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{fmt(row.amount)}</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  opacity: isHovered ? 1 : 0.7,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
