'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '@/lib/api'
import type { Account } from '@/lib/types'
import { Plus, Pencil, Trash2, Wallet, PiggyBank, CreditCard, CalendarDays, CircleDollarSign } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const TYPE_LABELS = { checking: 'Débito', savings: 'Ahorro', credit_card: 'Tarjeta de crédito' }
const TYPE_ICONS = {
  checking: <Wallet size={16} />,
  savings: <PiggyBank size={16} />,
  credit_card: <CreditCard size={16} />,
}

interface FormState {
  name: string
  account_type: Account['account_type']
  balance: number
  currency: string
  is_active: boolean
  credit_limit: number | null
  current_balance_used: number | null
  closing_day: number | null
  payment_day: number | null
  id?: string
}

const EMPTY: FormState = {
  name: '',
  account_type: 'checking',
  balance: 0,
  currency: 'MXN',
  is_active: true,
  credit_limit: null,
  current_balance_used: null,
  closing_day: null,
  payment_day: null,
}

function CreditUsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#4F8EF7]'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-black/40 dark:text-white/40">
        <span>{fmt(used)} usado</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/[0.08]">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CreditCardItem({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const used = account.current_balance_used ?? 0
  const limit = account.credit_limit ?? 0
  const available = limit > 0 ? limit - used : null

  return (
    <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl p-5 border border-black/10 dark:border-white/10 shadow-lg hover:border-amber-400/30 transition-all space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-400/10 p-2.5">
            <CreditCard size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-black dark:text-white">{account.name}</p>
            <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Tarjeta de crédito · {account.currency}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Usado</p>
          <p className="text-sm font-semibold text-amber-400 tabular-nums">{fmt(used)}</p>
        </div>
        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Disponible</p>
          <p className="text-sm font-semibold text-emerald-400 tabular-nums">{available !== null ? fmt(available) : '—'}</p>
        </div>
        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-black/40 dark:text-white/40 mb-1">Límite</p>
          <p className="text-sm font-semibold text-black dark:text-white tabular-nums">{limit > 0 ? fmt(limit) : '—'}</p>
        </div>
      </div>

      {/* Usage bar */}
      {limit > 0 && <CreditUsageBar used={used} limit={limit} />}

      {/* Dates */}
      {(account.closing_day || account.payment_day) && (
        <div className="flex items-center gap-4 pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
          <CalendarDays size={13} className="text-black/30 dark:text-white/30 flex-shrink-0" />
          {account.closing_day && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-black/40 dark:text-white/40">Corte:</span>
              <span className="text-[11px] font-medium text-black dark:text-white">día {account.closing_day}</span>
            </div>
          )}
          {account.closing_day && account.payment_day && (
            <div className="w-px h-3 bg-black/10 dark:bg-white/10" />
          )}
          {account.payment_day && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-black/40 dark:text-white/40">Pago:</span>
              <span className="text-[11px] font-medium text-[#4F8EF7]">día {account.payment_day}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AccountRow({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const color = account.account_type === 'savings' ? 'text-emerald-400' : 'text-[#4F8EF7]'
  return (
    <div className="flex items-center justify-between bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl px-5 py-4 border border-black/10 dark:border-white/10 shadow-lg hover:border-black/20 dark:hover:border-white/20 transition-all">
      <div className="flex items-center gap-3">
        <div className={color}>{TYPE_ICONS[account.account_type]}</div>
        <div>
          <p className="text-sm font-medium text-black dark:text-white">{account.name}</p>
          <p className="text-xs text-black/40 dark:text-white/40">{TYPE_LABELS[account.account_type]}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <span className={`text-base font-semibold tabular-nums ${color}`}>{fmt(Number(account.balance))}</span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY)
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
    setForm({
      name: a.name,
      account_type: a.account_type,
      balance: Number(a.balance),
      currency: a.currency,
      is_active: a.is_active,
      credit_limit: a.credit_limit ? Number(a.credit_limit) : null,
      current_balance_used: a.current_balance_used ? Number(a.current_balance_used) : null,
      closing_day: a.closing_day,
      payment_day: a.payment_day,
      id: a.id,
    })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const { id, ...payload } = form as FormState & { id?: string }
      if (id) await updateAccount(id, payload)
      else await createAccount(payload)
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

  const cards = accounts.filter(a => a.account_type === 'credit_card')
  const other = accounts.filter(a => a.account_type !== 'credit_card')
  const totalAssets = other.reduce((s, a) => s + Number(a.balance), 0)
  const totalUsed = cards.reduce((s, a) => s + (Number(a.current_balance_used) || 0), 0)
  const totalAvailable = cards.reduce((s, a) => s + (Number(a.available_credit) || 0), 0)

  const isCreditCard = form.account_type === 'credit_card'

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-black dark:text-white">Cuentas</h1>
            <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">Administra tus cuentas y tarjetas</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:bg-white/90 hover:scale-105 active:scale-95 transition-colors"
          >
            <Plus size={15} /> Nueva cuenta
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg transition-all">
            <p className="text-[10px] text-black/40 dark:text-white/40 mb-1 uppercase tracking-wide">Total activos</p>
            <p className="text-lg font-semibold text-black dark:text-white tabular-nums">{fmt(totalAssets)}</p>
          </div>
          <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg transition-all">
            <p className="text-[10px] text-black/40 dark:text-white/40 mb-1 uppercase tracking-wide">Deuda tarjetas</p>
            <p className="text-lg font-semibold text-amber-400 tabular-nums">{fmt(totalUsed)}</p>
          </div>
          <div className="bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-black/10 dark:border-white/10 shadow-lg transition-all">
            <p className="text-[10px] text-black/40 dark:text-white/40 mb-1 uppercase tracking-wide">Crédito disp.</p>
            <p className="text-lg font-semibold text-emerald-400 tabular-nums">{fmt(totalAvailable)}</p>
          </div>
        </div>

        {/* Credit cards section */}
        {cards.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-widest">Tarjetas de crédito</p>
            {cards.map(a => (
              <CreditCardItem key={a.id} account={a} onEdit={() => openEdit(a)} onDelete={() => remove(a.id)} />
            ))}
          </div>
        )}

        {/* Other accounts */}
        {other.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-widest">Cuentas</p>
            {other.map(a => (
              <AccountRow key={a.id} account={a} onEdit={() => openEdit(a)} onDelete={() => remove(a.id)} />
            ))}
          </div>
        )}

        {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" /></div>}
        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 text-black/30 dark:text-white/30 text-sm">No tienes cuentas aún. ¡Agrega tu primera!</div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#141414] rounded-2xl border border-white/[0.08] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-black dark:text-white">
              {(form as FormState).id ? 'Editar cuenta' : 'Nueva cuenta'}
            </h2>

            {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="Ej. BBVA Oro" />
              </div>

              <div>
                <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Tipo</label>
                <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value as Account['account_type'] })}
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]">
                  <option value="checking">Débito / Cheques</option>
                  <option value="savings">Ahorro</option>
                  <option value="credit_card">Tarjeta de crédito</option>
                </select>
              </div>

              {!isCreditCard ? (
                <div>
                  <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Saldo actual</label>
                  <input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })}
                    className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Límite de crédito</label>
                      <input type="number" value={form.credit_limit ?? ''} onChange={e => setForm({ ...form, credit_limit: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Saldo usado ahora</label>
                      <input type="number" value={form.current_balance_used ?? ''} onChange={e => setForm({ ...form, current_balance_used: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Día de corte</label>
                      <input type="number" min={1} max={31} value={form.closing_day ?? ''} onChange={e => setForm({ ...form, closing_day: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="15" />
                    </div>
                    <div>
                      <label className="block text-xs text-black/50 dark:text-white/50 mb-1">Día de pago</label>
                      <input type="number" min={1} max={31} value={form.payment_day ?? ''} onChange={e => setForm({ ...form, payment_day: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-[#4F8EF7]" placeholder="10" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-black/60 dark:text-white/60 hover:bg-white/[0.05] transition-colors">
                Cancelar
              </button>
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
