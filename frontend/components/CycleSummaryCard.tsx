'use client'

import { useState } from 'react'
import { Pencil, ChevronDown } from 'lucide-react'
import type { Income, MonthProjection } from '@/lib/types'

interface CycleSummaryCardProps {
  cycle: MonthProjection
  cycleStartDay: number | null
  // Point incomes of the current cycle that count toward "disponible" (no savings accounts)
  variableIncomes: Income[]
  onEditIncome: () => void
}

const CORAL = '#FF6B6B'
const GREEN = '#34d399'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string) => iso.split('-').reverse().join('/')

function Row({ sign, label, hint, value, color, action }: {
  sign?: '+' | '−' | '='
  label: string
  hint?: string
  value: number
  color?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-3 text-center text-xs text-black/30 dark:text-white/30">{sign}</span>
        <div className="min-w-0">
          <p className="text-sm text-black/80 dark:text-white/80">{label}</p>
          {hint && <p className="text-[10px] text-black/30 dark:text-white/30">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums text-black dark:text-white" style={color ? { color } : undefined}>
          {fmt(value)}
        </span>
        {action}
      </div>
    </div>
  )
}

export default function CycleSummaryCard({ cycle, cycleStartDay, variableIncomes, onEditIncome }: CycleSummaryCardProps) {
  const [open, setOpen] = useState<boolean>(false)

  const monthly = Number(cycle.income)
  const variable = variableIncomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalIncome = monthly + variable
  const commitments =
    Number(cycle.recurring_expenses) + Number(cycle.installments) + Number(cycle.savings_contributions)
  const spent = Number(cycle.cash_debit_spent) + Number(cycle.credit_spent)
  const available = Number(cycle.available)
  const isNeg = available < 0

  // Bar: how the total income is split
  const base = Math.max(totalIncome, commitments + spent, 1)
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / base) * 100))}%`
  const left = Math.max(0, available)

  return (
    <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm p-6">
      <p className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">Disponible este ciclo</p>
      <p className="text-4xl font-bold tabular-nums text-black dark:text-white" style={isNeg ? { color: CORAL } : undefined}>
        {fmt(available)}
      </p>
      <p className="text-xs text-black/40 dark:text-white/40 mt-1.5">
        {isNeg ? 'Déficit este ciclo' : 'Después de compromisos y gastos'} · {cycle.label}
      </p>

      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/[0.06] mt-5 gap-px">
        <div style={{ width: pct(commitments), backgroundColor: CORAL, opacity: 0.55 }} />
        <div className="bg-black/30 dark:bg-white/35" style={{ width: pct(spent) }} />
        <div style={{ width: pct(left), backgroundColor: GREEN, opacity: 0.8 }} />
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-black/40 dark:text-white/40">
        <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: CORAL, opacity: 0.55 }} />Compromisos</span>
        <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full inline-block bg-black/30 dark:bg-white/35" />Gastado</span>
        <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: GREEN, opacity: 0.8 }} />Disponible</span>
      </div>

      <div className="mt-4 divide-y divide-black/[0.06] dark:divide-white/[0.06] border-t border-black/[0.06] dark:border-white/[0.06]">
        <Row
          label="Ingreso mensual"
          hint={cycleStartDay ? `Ciclo desde el día ${cycleStartDay}` : undefined}
          value={monthly}
          action={
            <button onClick={onEditIncome} className="p-1 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Pencil size={12} />
            </button>
          }
        />
        <div>
          <Row
            sign="+"
            label="Ingresos variables"
            hint={variableIncomes.length === 0 ? 'Sin ingresos extra este ciclo' : `${variableIncomes.length} ${variableIncomes.length === 1 ? 'ingreso' : 'ingresos'} · sin cuentas de ahorro`}
            value={variable}
            color={variable > 0 ? GREEN : undefined}
            action={variableIncomes.length > 0 ? (
              <button onClick={() => setOpen(!open)} className="p-1 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors">
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            ) : undefined}
          />
          {open && (
            <div className="pb-2 pl-6 space-y-1.5">
              {variableIncomes.map(i => (
                <div key={i.id} className="flex items-center justify-between text-[11px] text-black/50 dark:text-white/50">
                  <span className="truncate pr-3">{i.description} · {fmtDate(i.date)}</span>
                  <span className="tabular-nums shrink-0">{fmt(Number(i.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <Row sign="=" label="Total ingresos" value={totalIncome} />
        <Row sign="−" label="Compromisos" hint="Recurrentes y MSI" value={commitments} color={CORAL} />
        <Row sign="−" label="Gastado" hint="Tarjetas, efectivo y débito" value={spent} />
      </div>
    </div>
  )
}
