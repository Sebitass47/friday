'use client'

import { useState } from 'react'
import { Pencil, ChevronDown } from 'lucide-react'
import type { Expense, Income, MonthProjection } from '@/lib/types'
import BalanceFlowChart from '@/components/charts/BalanceFlowChart'

interface CycleSummaryCardProps {
  cycle: MonthProjection
  cycleStartDay: number | null
  expenses: Expense[]
  // Point incomes that count toward "disponible" (no savings accounts), any date
  countedIncomes: Income[]
  // Subset of countedIncomes inside the current cycle up to today
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

export default function CycleSummaryCard({
  cycle, cycleStartDay, expenses, countedIncomes, variableIncomes, onEditIncome,
}: CycleSummaryCardProps) {
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false)
  const [showVariable, setShowVariable] = useState<boolean>(false)

  const monthly = Number(cycle.income)
  const variable = variableIncomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalIncome = monthly + variable
  const commitments =
    Number(cycle.recurring_expenses) + Number(cycle.installments) + Number(cycle.savings_contributions)
  const spent = Number(cycle.cash_debit_spent) + Number(cycle.credit_spent)

  return (
    <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-black dark:text-white">Tu dinero este ciclo</h2>
        <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">{cycle.label} · toca la línea para ver cada día</p>
      </div>

      <BalanceFlowChart cycle={cycle} expenses={expenses} incomes={countedIncomes} />

      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        {showBreakdown ? 'Ocultar desglose' : 'Ver desglose'}
        <ChevronDown size={13} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
      </button>

      <div className={`grid transition-all duration-300 ease-out ${showBreakdown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="mt-2 divide-y divide-black/[0.06] dark:divide-white/[0.06] border-t border-black/[0.06] dark:border-white/[0.06]">
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
                  <button onClick={() => setShowVariable(!showVariable)} className="p-1 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors">
                    <ChevronDown size={14} className={`transition-transform ${showVariable ? 'rotate-180' : ''}`} />
                  </button>
                ) : undefined}
              />
              {showVariable && (
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
      </div>
    </div>
  )
}
