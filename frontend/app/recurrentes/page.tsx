'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getRecurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense } from '@/lib/api'
import type { RecurringExpense } from '@/lib/types'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const FREQ_LABELS = { monthly: 'Mensual', weekly: 'Semanal', custom: 'Personalizado' }

const EMPTY = { name: '', amount: 0, frequency: 'monthly' as RecurringExpense['frequency'], interval_days: null as number | null }

export default function RecurrentesPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { setExpenses(await getRecurringExpenses()) }
    catch { /* handled */ }
    finally { setLoading(false) }
  }

  function openNew() { setForm(EMPTY); setError(''); setShowForm(true) }
  function openEdit(e: RecurringExpense) {
    setForm({ name: e.name, amount: Number(e.amount), frequency: e.frequency, interval_days: e.interval_days, id: e.id })
    setError(''); setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.amount <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (form.frequency === 'custom' && !form.interval_days) { setError('Indica el intervalo en días'); return }
    setSaving(true); setError('')
    try {
      if (form.id) await updateRecurringExpense(form.id, form)
      else await createRecurringExpense(form)
      await load(); setShowForm(false)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await deleteRecurringExpense(id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Gastos recurrentes</h1>
            <p className="text-xs text-white/40 mt-0.5">Pagos que salen cada mes</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-[#4F8EF7] px-3 py-2 text-sm font-medium text-white hover:bg-[#4F8EF7]/80 transition-colors">
            <Plus size={15} /> Agregar
          </button>
        </div>

        <div className="bg-[#141414] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <RefreshCw size={14} />
            <span>{expenses.length} gastos recurrentes</span>
          </div>
          <span className="text-base font-semibold text-red-400 tabular-nums">{fmt(total)}/mes</span>
        </div>

        <div className="space-y-2">
          {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" /></div>}
          {!loading && expenses.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">Sin gastos recurrentes. ¡Agrega renta, Netflix, gym…!</div>
          )}
          {expenses.map(e => (
            <div key={e.id} className="flex items-center justify-between bg-[#141414] rounded-xl px-5 py-4 border border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">{e.name}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {FREQ_LABELS[e.frequency]}{e.frequency === 'custom' && e.interval_days ? ` · cada ${e.interval_days} días` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white tabular-nums">{fmt(Number(e.amount))}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#141414] rounded-2xl border border-white/[0.08] p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">{form.id ? 'Editar gasto' : 'Nuevo gasto recurrente'}</h2>
            {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. Renta, Netflix, Gym…" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Monto</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Frecuencia</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RecurringExpense['frequency'] }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]">
                  <option value="monthly">Mensual</option>
                  <option value="weekly">Semanal</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              {form.frequency === 'custom' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1">Cada cuántos días</label>
                  <input type="number" min={1} value={form.interval_days ?? ''} onChange={e => setForm(f => ({ ...f, interval_days: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
                </div>
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
