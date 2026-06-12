'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '@/lib/api'
import type { Account } from '@/lib/types'
import { Plus, Pencil, Trash2, Wallet, PiggyBank, CreditCard } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n)

const TYPE_LABELS = { checking: 'Débito', savings: 'Ahorro', credit_card: 'Tarjeta de crédito' }
const TYPE_ICONS = {
  checking: <Wallet size={16} />,
  savings: <PiggyBank size={16} />,
  credit_card: <CreditCard size={16} />,
}
const TYPE_COLORS = {
  checking: 'text-[#4F8EF7]',
  savings: 'text-emerald-400',
  credit_card: 'text-amber-400',
}

const EMPTY = { name: '', account_type: 'checking' as Account['account_type'], balance: 0, currency: 'MXN', is_active: true, credit_limit: null, closing_day: null, payment_day: null }

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY | (typeof EMPTY & { id?: string })>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { setAccounts(await getAccounts()) }
    catch { /* handled by api */ }
    finally { setLoading(false) }
  }

  function openNew() { setForm(EMPTY); setError(''); setShowForm(true) }
  function openEdit(a: Account) {
    setForm({ name: a.name, account_type: a.account_type, balance: Number(a.balance), currency: a.currency, is_active: a.is_active, credit_limit: a.credit_limit ? Number(a.credit_limit) : null, closing_day: a.closing_day, payment_day: a.payment_day, id: a.id })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const id = (form as typeof EMPTY & { id?: string }).id
      if (id) await updateAccount(id, form)
      else await createAccount(form)
      await load()
      setShowForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await deleteAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  const totalAssets = accounts.filter(a => a.account_type !== 'credit_card').reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt = accounts.filter(a => a.account_type === 'credit_card').reduce((s, a) => s + Number(a.balance), 0)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Cuentas</h1>
            <p className="text-xs text-white/40 mt-0.5">Administra tus cuentas bancarias</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-[#4F8EF7] px-3 py-2 text-sm font-medium text-white hover:bg-[#4F8EF7]/80 transition-colors"
          >
            <Plus size={15} /> Nueva cuenta
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#141414] rounded-xl p-4 border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-1">Total activos</p>
            <p className="text-xl font-semibold text-white tabular-nums">{fmt(totalAssets)}</p>
          </div>
          <div className="bg-[#141414] rounded-xl p-4 border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-1">Deuda tarjetas</p>
            <p className="text-xl font-semibold text-amber-400 tabular-nums">{fmt(totalDebt)}</p>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" /></div>}
          {!loading && accounts.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">No tienes cuentas aún. ¡Agrega tu primera!</div>
          )}
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-[#141414] rounded-xl px-5 py-4 border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className={`${TYPE_COLORS[a.account_type]}`}>{TYPE_ICONS[a.account_type]}</div>
                <div>
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <p className="text-xs text-white/40">{TYPE_LABELS[a.account_type]}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className={`text-base font-semibold tabular-nums ${a.account_type === 'credit_card' ? 'text-amber-400' : 'text-white'}`}>
                  {fmt(Number(a.balance))}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#141414] rounded-2xl border border-white/[0.08] p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">
              {(form as typeof EMPTY & { id?: string }).id ? 'Editar cuenta' : 'Nueva cuenta'}
            </h2>

            {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. BBVA Débito" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Tipo</label>
                <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as Account['account_type'] }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]">
                  <option value="checking">Débito / Cheques</option>
                  <option value="savings">Ahorro</option>
                  <option value="credit_card">Tarjeta de crédito</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Saldo actual</label>
                <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: Number(e.target.value) }))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
              </div>
              {form.account_type === 'credit_card' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Límite</label>
                    <input type="number" value={form.credit_limit ?? ''} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Día corte</label>
                    <input type="number" min={1} max={31} value={form.closing_day ?? ''} onChange={e => setForm(f => ({ ...f, closing_day: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Día pago</label>
                    <input type="number" min={1} max={31} value={form.payment_day ?? ''} onChange={e => setForm(f => ({ ...f, payment_day: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4F8EF7]" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/[0.05] transition-colors">
                Cancelar
              </button>
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
