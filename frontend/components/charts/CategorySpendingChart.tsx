'use client'

import { useState, useEffect } from 'react'
import type { Expense } from '@/lib/types'

interface CategorySpendingChartProps {
  expenses: Expense[]
  cycleStart: string
  cycleEnd: string
  onCategoryClick?: (category: string, expenses: Expense[]) => void
}

const HIDDEN_KEY = 'friday_hidden_categories'
// Transfers between accounts are not real spending, hide them until the user decides otherwise.
const DEFAULT_HIDDEN = ['Transferencia']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export default function CategorySpendingChart({ expenses, cycleStart, cycleEnd, onCategoryClick }: CategorySpendingChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY)
      if (raw) setHidden(JSON.parse(raw) as string[])
    } catch {}
  }, [])

  function toggleCategory(name: string) {
    const next = hidden.includes(name) ? hidden.filter(n => n !== name) : [...hidden, name]
    setHidden(next)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch {}
  }

  const map = new Map<string, { amount: number; items: Expense[] }>()
  for (const e of expenses) {
    const cat = e.category?.trim() || 'Sin categoría'
    const prev = map.get(cat) ?? { amount: 0, items: [] }
    map.set(cat, { amount: prev.amount + Number(e.amount), items: [...prev.items, e] })
  }

  if (map.size === 0) return null

  const allRows = Array.from(map.entries())
    .map(([name, { amount, items }]) => ({ name, amount, items }))
    .sort((a, b) => b.amount - a.amount)

  const rows = allRows.filter(r => !hidden.includes(r.name))
  const max = rows[0]?.amount ?? 1
  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {allRows.map(r => {
          const isHidden = hidden.includes(r.name)
          return (
            <button
              key={r.name}
              onClick={() => toggleCategory(r.name)}
              className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${
                isHidden
                  ? 'border-black/10 dark:border-white/10 text-black/30 dark:text-white/30 line-through'
                  : 'border-black/25 dark:border-white/25 bg-black/[0.07] dark:bg-white/10 text-black/80 dark:text-white/85'
              }`}
            >
              {r.name}
            </button>
          )
        })}
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-black/40 dark:text-white/40 py-2">Todas las categorías están ocultas.</p>
      )}
      {rows.length > 0 && (
        <p className="text-[11px] text-black/40 dark:text-white/40">
          Total visible <span className="font-semibold tabular-nums text-black/80 dark:text-white/85">{fmt(total)}</span>
        </p>
      )}
    <div className="space-y-2">
      {rows.map(row => {
        const pct = Math.max(4, (row.amount / max) * 100)
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
                <span className="text-[11px] font-semibold tabular-nums text-black/80 dark:text-white/85">{fmt(row.amount)}</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-black dark:bg-white"
                style={{
                  width: `${pct}%`,
                  opacity: isHovered ? 0.85 : 0.55,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}
