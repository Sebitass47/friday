'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ProjectionChart from '@/components/charts/ProjectionChart'
import { getProjection, getInstallmentPurchases, getSavingsGoals, getMe } from '@/lib/api'
import type { ProjectionResponse, InstallmentPurchase, SavingsGoal, User } from '@/lib/types'
import { TrendingUp, TrendingDown, Minus, CreditCard, Target } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const pct = (current: number, target: number) =>
  Math.min(100, Math.round((current / target) * 100))

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [msi, setMsi] = useState<InstallmentPurchase[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), getProjection(12), getInstallmentPurchases(), getSavingsGoals()])
      .then(([u, p, m, g]) => {
        setUser(u)
        setProjection(p)
        setMsi(m)
        setGoals(g)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const thisMonth = projection?.months[0]
  const totalExpenses = thisMonth
    ? thisMonth.recurring_expenses + thisMonth.installments + thisMonth.savings_contributions
    : 0
  const available = thisMonth?.available ?? 0
  const isNeg = available < 0

  const activeMsi = msi.filter(m => m.remaining_installments > 0)

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-sm text-white/40">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-semibold text-white mt-0.5">
            Hola{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Disponible este mes */}
          <div className="col-span-1 bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Disponible este mes</p>
            <p className={`text-4xl font-bold tabular-nums ${isNeg ? 'text-red-400' : 'text-white'}`}>
              {fmt(available)}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {isNeg
                ? <TrendingDown size={14} className="text-red-400" />
                : available < (thisMonth?.income ?? 0) * 0.2
                ? <Minus size={14} className="text-amber-400" />
                : <TrendingUp size={14} className="text-emerald-400" />
              }
              <span className="text-xs text-white/40">
                {isNeg ? 'Déficit este mes' : 'Después de todos los compromisos'}
              </span>
            </div>
          </div>

          {/* Ingreso */}
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Ingreso mensual</p>
            <p className="text-2xl font-semibold text-white tabular-nums">{fmt(thisMonth?.income ?? 0)}</p>
            <p className="text-xs text-white/30 mt-2">Base este mes</p>
          </div>

          {/* Compromisos */}
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Total compromisos</p>
            <p className="text-2xl font-semibold text-red-400 tabular-nums">{fmt(totalExpenses)}</p>
            <div className="flex flex-col gap-0.5 mt-2">
              <p className="text-[11px] text-white/30">
                Recurrentes {fmt(thisMonth?.recurring_expenses ?? 0)} · MSI {fmt(thisMonth?.installments ?? 0)} · Ahorro {fmt(thisMonth?.savings_contributions ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Proyección 12 meses</h2>
              <p className="text-xs text-white/40 mt-0.5">Dinero disponible mes a mes</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#4F8EF7]/70" /> Positivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-red-500/70" /> Déficit
              </span>
            </div>
          </div>
          {projection && <ProjectionChart months={projection.months} />}
        </div>

        {/* Bottom row: MSI + Goals */}
        <div className="grid grid-cols-2 gap-4">
          {/* Active MSI */}
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={15} className="text-[#4F8EF7]" />
              <h2 className="text-sm font-semibold text-white">MSI activos</h2>
              <span className="ml-auto text-xs text-white/30">{activeMsi.length}</span>
            </div>
            {activeMsi.length === 0 ? (
              <p className="text-xs text-white/30 py-4 text-center">Sin MSI activos</p>
            ) : (
              <div className="space-y-3">
                {activeMsi.slice(0, 4).map(item => {
                  const paid = item.total_installments - item.remaining_installments
                  const progress = pct(paid, item.total_installments)
                  return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white truncate max-w-[60%]">{item.name}</span>
                        <span className="text-xs text-white/50 tabular-nums">
                          {fmt(item.monthly_amount)}/mes · {item.remaining_installments} restantes
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-1 rounded-full bg-[#4F8EF7]/60"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {activeMsi.length > 4 && (
                  <p className="text-xs text-white/30 text-center pt-1">+{activeMsi.length - 4} más</p>
                )}
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="bg-[#141414] rounded-2xl p-6 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Target size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Metas de ahorro</h2>
              <span className="ml-auto text-xs text-white/30">{goals.length}</span>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-white/30 py-4 text-center">Sin metas configuradas</p>
            ) : (
              <div className="space-y-3">
                {goals.slice(0, 4).map(goal => {
                  const progress = pct(Number(goal.current_amount), Number(goal.target_amount))
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white truncate max-w-[55%]">{goal.name}</span>
                        <span className="text-xs text-white/50 tabular-nums">
                          {fmt(Number(goal.current_amount))} / {fmt(Number(goal.target_amount))}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-1 rounded-full bg-emerald-400/70"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {goal.estimated_completion_date && (
                        <p className="text-[10px] text-white/25 mt-0.5">
                          Meta: {new Date(goal.estimated_completion_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )
                })}
                {goals.length > 4 && (
                  <p className="text-xs text-white/30 text-center pt-1">+{goals.length - 4} más</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
