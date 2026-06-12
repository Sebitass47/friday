'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '@/lib/api'
import type { SavingsGoal } from '@/lib/types'
import { Plus, Pencil, Trash2, Target, CalendarDays } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const EMPTY = { name: '', target_amount: 0, current_amount: 0, monthly_contribution: 0 }

export default function MetasPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { setGoals(await getSavingsGoals()) }
    catch { /* handled */ }
    finally { setLoading(false) }
  }

  function openNew() { setForm(EMPTY); setError(''); setShowForm(true) }
  function openEdit(g: SavingsGoal) {
    setForm({ name: g.name, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount), monthly_contribution: Number(g.monthly_contribution), id: g.id })
    setError(''); setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.target_amount <= 0) { setError('La meta debe ser mayor a 0'); return }
    setSaving(true); setError('')
    try {
      if (form.id) await updateSavingsGoal(form.id, form)
      else await createSavingsGoal(form)
      await load(); setShowForm(false)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    await deleteSavingsGoal(id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const totalMonthly = goals.reduce((s, g) => s + Number(g.monthly_contribution), 0)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Metas de ahorro</h1>
            <p className="text-xs text-white/40 mt-0.5">Hacia dónde va tu dinero</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-[#4F8EF7] px-3 py-2 text-sm font-medium text-white hover:bg-[#4F8EF7]/80 transition-colors">
            <Plus size={15} /> Nueva meta
          </button>
        </div>

        <div className="bg-[#141414] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Target size={14} className="text-emerald-400" />
            <span>{goals.length} metas activas</span>
          </div>
          <span className="text-base font-semibold text-emerald-400 tabular-nums">{fmt(totalMonthly)}/mes comprometido</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" /></div>}
          {!loading && goals.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">
              Sin metas aún. ¿Para qué estás ahorrando?
            </div>
          )}
          {goals.map(g => {
            const progress = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
            const remaining = Number(g.target_amount) - Number(g.current_amount)
            const done = remaining <= 0

            return (
              <div key={g.id} className="bg-[#141414] rounded-xl p-5 border border-white/[0.06] space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{g.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {fmt(Number(g.monthly_contribution))}/mes · {fmt(Number(g.current_amount))} ahorrado
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => remove(g.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className={`text-2xl font-bold tabular-nums ${done ? 'text-emerald-400' : 'text-white'}`}>
                      {progress}%
                    </span>
                    <span className="text-sm text-white/40 tabular-nums">
                      {done ? '¡Meta alcanzada!' : `${fmt(remaining)} restante`}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.06]">
                    <div
                      className={`h-2 rounded-full transition-all ${done ? 'bg-emerald-400' : 'bg-emerald-400/60'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[11px] text-white/30">
                    <span>{fmt(Number(g.current_amount))}</span>
                    <span>{fmt(Number(g.target_amount))}</span>
                  </div>
                </div>

                {g.estimated_completion_date && !done && (
                  <div className="flex items-center gap-1.5 text-xs text-white/30">
                    <CalendarDays size={12} />
                    <span>
                      Llegas en {new Date(g.estimated_completion_date + 'T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#141414] rounded-2xl border border-white/[0.08] p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">{form.id ? 'Editar meta' : 'Nueva meta de ahorro'}</h2>
            {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">¿Para qué estás ahorrando?</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. PC gaming, viaje, emergencias…" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Meta total</label>
                <input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: Number(e.target.value) }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Ya ahorré</label>
                <input type="number" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: Number(e.target.value) }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Ahorro mensual comprometido</label>
                <input type="number" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: Number(e.target.value) }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
              </div>
              {form.monthly_contribution > 0 && form.target_amount > form.current_amount && (
                <p className="text-xs text-emerald-400/80 bg-emerald-400/10 rounded-lg px-3 py-2">
                  Llegarás en ~{Math.ceil((form.target_amount - form.current_amount) / form.monthly_contribution)} meses
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/[0.05] transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-[#4F8EF7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4F8EF7]/80 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
