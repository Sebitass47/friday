'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ProjectionChart from '@/components/charts/ProjectionChart'
import { getProjection, simulateProjection } from '@/lib/api'
import type { ProjectionResponse, SimulationResponse } from '@/lib/types'
import { Sparkles, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const today = () => new Date().toISOString().split('T')[0]

export default function SimuladorPage() {
  const [form, setForm] = useState({
    name: '',
    total_amount: 0,
    monthly_amount: 0,
    total_installments: 12,
    start_date: today(),
  })
  const [base, setBase] = useState<ProjectionResponse | null>(null)
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function simulate() {
    if (!form.name.trim()) { setError('Pon un nombre al producto'); return }
    if (form.monthly_amount <= 0) { setError('El pago mensual debe ser mayor a 0'); return }
    if (form.total_installments <= 0) { setError('Los meses deben ser mayor a 0'); return }
    setError(''); setLoading(true)
    try {
      const [b, s] = await Promise.all([getProjection(12), simulateProjection(form, 12)])
      setBase(b)
      setSimulation(s)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al simular') }
    finally { setLoading(false) }
  }

  function reset() { setBase(null); setSimulation(null); setError('') }

  const negativeMonths = simulation?.months.filter(m => m.available < 0).length ?? 0
  const totalImpact = simulation?.impact_summary ?? 0
  const worstMonth = simulation?.months.reduce((w, m) => m.available < (w?.available ?? 0) ? m : w, simulation.months[0])

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Simulador</h1>
          <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">¿Qué pasaría si compras esto a MSI?</p>
        </div>

        {/* Form */}
        <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:hover:border-white/20 transition-all p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-[#4F8EF7]" />
            <h2 className="text-sm font-medium text-black dark:text-white">Simula una compra a MSI</h2>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-black/50 dark:text-white/50 mb-1">¿Qué quieres comprar?</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onFocus={reset}
                className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. Sony WH-1000XM6, PS5, sillón…" />
            </div>
            <div>
              <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Precio total</label>
              <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))} onFocus={reset}
                className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
            </div>
            <div>
              <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Pago mensual</label>
              <input type="number" value={form.monthly_amount} onChange={e => setForm(f => ({ ...f, monthly_amount: Number(e.target.value) }))} onFocus={reset}
                className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
            </div>
            <div>
              <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Número de meses</label>
              <input type="number" min={1} max={48} value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: Number(e.target.value) }))} onFocus={reset}
                className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
            </div>
            <div>
              <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Inicio</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} onFocus={reset}
                className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
            </div>
          </div>

          {form.total_amount > 0 && form.total_installments > 0 && (
            <p className="text-xs text-black/30 dark:text-white/30">
              {form.total_installments} pagos de{' '}
              <span className="text-[#4F8EF7] font-medium">{fmt(form.monthly_amount || form.total_amount / form.total_installments)}</span>
              {' '}= {fmt(form.monthly_amount * form.total_installments || form.total_amount)} total
            </p>
          )}

          <button onClick={simulate} disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-white/90 hover:scale-105 active:scale-95 disabled:opacity-50 transition-colors">
            <Sparkles size={14} />
            {loading ? 'Calculando…' : '¿Puedo pagarlo?'}
          </button>
        </div>

        {/* Results */}
        {simulation && base && (
          <>
            {/* Impact cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border ${negativeMonths > 0 ? 'border-red-500/30' : 'border-white/[0.06]'}`}>
                <p className="text-xs text-black/40 dark:text-white/40 mb-2">Meses en déficit</p>
                <div className="flex items-center gap-2">
                  {negativeMonths > 0
                    ? <TrendingDown size={18} className="text-red-400" />
                    : <TrendingUp size={18} className="text-emerald-400" />
                  }
                  <span className={`text-2xl font-bold ${negativeMonths > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {negativeMonths}
                  </span>
                </div>
                <p className="text-xs text-black/30 dark:text-white/30 mt-1">de los próximos 12 meses</p>
              </div>

              <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:border-white/20 transition-all">
                <p className="text-xs text-black/40 dark:text-white/40 mb-2">Impacto total (12m)</p>
                <p className="text-2xl font-bold text-amber-400 tabular-nums">−{fmt(totalImpact)}</p>
                <p className="text-xs text-black/30 dark:text-white/30 mt-1">Menos disponible en total</p>
              </div>

              <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:border-white/20 transition-all">
                <p className="text-xs text-black/40 dark:text-white/40 mb-2">Peor mes</p>
                <p className={`text-2xl font-bold tabular-nums ${(worstMonth?.available ?? 0) < 0 ? 'text-red-400' : 'text-black dark:text-white'}`}>
                  {fmt(worstMonth?.available ?? 0)}
                </p>
                <p className="text-xs text-black/30 dark:text-white/30 mt-1">{worstMonth?.label}</p>
              </div>
            </div>

            {/* Warning */}
            {negativeMonths > 0 && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-400">Ojo — {negativeMonths} {negativeMonths === 1 ? 'mes' : 'meses'} en números rojos</p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                    Con este MSI tendrías déficit en {negativeMonths} de los próximos 12 meses. Considera reducir el monto o el plazo.
                  </p>
                </div>
              </div>
            )}

            {negativeMonths === 0 && (
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <TrendingUp size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">¡Se puede! Todos los meses quedan en positivo</p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                    Aunque el impacto total es {fmt(totalImpact)}, ningún mes cae en déficit.
                  </p>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl p-6 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:hover:border-white/20 transition-all">
              <h3 className="text-sm font-semibold text-black dark:text-white mb-1">Comparación mes a mes</h3>
              <p className="text-xs text-black/40 dark:text-white/40 mb-6">Azul = sin este MSI · Naranja = con el MSI</p>
              <ProjectionChart months={base.months} compareMonths={simulation.months} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
