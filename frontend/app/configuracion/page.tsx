'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getMonthlyIncome, setMonthlyIncome } from '@/lib/api'
import { DollarSign, Check } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export default function ConfiguracionPage() {
  const [amount, setAmount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMonthlyIncome()
      .then(i => setAmount(Number(i.amount)))
      .catch(() => {/* no income set yet */ })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (amount <= 0) { setError('El ingreso debe ser mayor a 0'); return }
    setSaving(true); setError(''); setSaved(false)
    try {
      await setMonthlyIncome(amount)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Configuración</h1>
          <p className="text-xs text-white/40 mt-0.5">Tu ingreso mensual base para la proyección</p>
        </div>

        <div className="bg-[#141414] rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition-all p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4F8EF7]/15">
              <DollarSign size={18} className="text-[#4F8EF7]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Ingreso mensual</p>
              <p className="text-xs text-white/40">Lo que entra a tu cuenta cada mes (neto)</p>
            </div>
          </div>

          {loading ? (
            <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
          ) : (
            <div className="space-y-2">
              <label className="block text-xs text-white/50">Monto mensual (MXN)</label>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(Number(e.target.value)); setSaved(false) }}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-3 text-lg font-semibold text-white outline-none focus:border-[#4F8EF7] tabular-nums transition-colors"
              />
              {amount > 0 && <p className="text-xs text-white/30">{fmt(amount)} al mes</p>}
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-white/90 hover:scale-105 active:scale-95 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : saved ? <><Check size={15} /> Guardado</> : 'Guardar ingreso'}
          </button>
        </div>

        <div className="bg-[#141414] rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition-all p-6">
          <h2 className="text-sm font-medium text-white mb-3">¿Cómo funciona la proyección?</h2>
          <div className="space-y-2 text-xs text-white/40 leading-relaxed">
            <p>FRIDAY usa tu ingreso mensual como base y resta todos tus compromisos mes a mes:</p>
            <ul className="space-y-1 pl-3">
              <li>• Gastos recurrentes (renta, suscripciones, etc.)</li>
              <li>• MSI activos (pago mensual × cuotas restantes)</li>
              <li>• Contribuciones a metas de ahorro</li>
            </ul>
            <p className="pt-1">El resultado es cuánto dinero libre tendrás disponible cada mes.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
