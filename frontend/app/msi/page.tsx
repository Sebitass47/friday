'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getInstallmentPurchases, createInstallmentPurchase, updateInstallmentPurchase, deleteInstallmentPurchase } from '@/lib/api'
import type { InstallmentPurchase } from '@/lib/types'
import { Plus, Pencil, Trash2, Package, CheckCircle2 } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const today = () => new Date().toISOString().split('T')[0]

const EMPTY = { name: '', total_amount: 0, monthly_amount: 0, total_installments: 12, remaining_installments: 12, start_date: today() }

export default function MsiPage() {
  const [items, setItems] = useState<InstallmentPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('active')

  useEffect(() => { load() }, [])

  async function load() {
    try { setItems(await getInstallmentPurchases()) }
    catch { /* handled */ }
    finally { setLoading(false) }
  }

  function openNew() { setForm({ ...EMPTY, start_date: today() }); setError(''); setShowForm(true) }
  function openEdit(item: InstallmentPurchase) {
    setForm({ name: item.name, total_amount: Number(item.total_amount), monthly_amount: Number(item.monthly_amount), total_installments: item.total_installments, remaining_installments: item.remaining_installments, start_date: item.start_date, id: item.id })
    setError(''); setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.monthly_amount <= 0) { setError('El pago mensual debe ser mayor a 0'); return }
    if (form.remaining_installments > form.total_installments) { setError('Las cuotas restantes no pueden ser mayores al total'); return }
    setSaving(true); setError('')
    try {
      if (form.id) await updateInstallmentPurchase(form.id, form)
      else await createInstallmentPurchase(form)
      await load(); setShowForm(false)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este MSI?')) return
    await deleteInstallmentPurchase(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => {
    if (filter === 'active') return i.remaining_installments > 0
    if (filter === 'done') return i.remaining_installments === 0
    return true
  })

  const totalMonthly = items.filter(i => i.remaining_installments > 0).reduce((s, i) => s + Number(i.monthly_amount), 0)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-black dark:text-white">MSI</h1>
            <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Meses sin intereses activos</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:bg-white/90 hover:scale-105 active:scale-95 transition-colors">
            <Plus size={15} /> Agregar MSI
          </button>
        </div>

        <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:border-white/20 transition-all flex items-center justify-between">
          <div className="flex items-center gap-2 text-black/40 dark:text-white/40 text-sm">
            <Package size={14} />
            <span>{items.filter(i => i.remaining_installments > 0).length} MSI activos</span>
          </div>
          <span className="text-base font-semibold text-[#4F8EF7] tabular-nums">{fmt(totalMonthly)}/mes</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-lg p-1 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:border-white/20 transition-all w-fit">
          {(['active', 'all', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-[#4F8EF7]/20 text-[#4F8EF7]' : 'text-black/40 dark:text-white/40 hover:text-black dark:text-white'}`}>
              {f === 'active' ? 'Activos' : f === 'done' ? 'Pagados' : 'Todos'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" /></div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-black/30 dark:text-white/30 text-sm">
              {filter === 'active' ? 'Sin MSI activos. ¿Compraste algo a meses?' : 'Sin MSI en esta categoría.'}
            </div>
          )}
          {filtered.map(item => {
            const paid = item.total_installments - item.remaining_installments
            const progress = Math.round((paid / item.total_installments) * 100)
            const done = item.remaining_installments === 0
            return (
              <div key={item.id} className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-5 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:border-white/20 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-black dark:text-white">{item.name}</p>
                      {done && <CheckCircle2 size={14} className="text-emerald-400" />}
                    </div>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                      Inicio: {new Date(item.start_date + 'T00:00:00').toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                      &nbsp;·&nbsp;Total: {fmt(Number(item.total_amount))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-black dark:text-white tabular-nums">{fmt(Number(item.monthly_amount))}/mes</p>
                      <p className="text-xs text-black/40 dark:text-white/40">{item.remaining_installments} de {item.total_installments} restantes</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:text-white hover:bg-white/[0.06] transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => remove(item.id)} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-black/30 dark:text-white/30 mb-1">
                    <span>Cuota {paid}/{item.total_installments}</span>
                    <span>{progress}% pagado</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div className={`h-1.5 rounded-full transition-all ${done ? 'bg-emerald-400/70' : 'bg-[#4F8EF7]/70'}`}
                      style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#141414] rounded-2xl border border-white/[0.08] p-6 space-y-4">
            <h2 className="text-base font-semibold text-black dark:text-white">{form.id ? 'Editar MSI' : 'Nuevo MSI'}</h2>
            {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Descripción</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. MacBook 18 MSI" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Monto total</label>
                  <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))}
                    className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
                </div>
                <div>
                  <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Pago mensual</label>
                  <input type="number" value={form.monthly_amount} onChange={e => setForm(f => ({ ...f, monthly_amount: Number(e.target.value) }))}
                    className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Total cuotas</label>
                  <input type="number" min={1} value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: Number(e.target.value) }))}
                    className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
                </div>
                <div>
                  <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Cuotas restantes</label>
                  <input type="number" min={0} value={form.remaining_installments} onChange={e => setForm(f => ({ ...f, remaining_installments: Number(e.target.value) }))}
                    className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Fecha de inicio</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-black/60 dark:text-white/60 hover:bg-white/[0.05] transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 hover:scale-105 active:scale-95 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
