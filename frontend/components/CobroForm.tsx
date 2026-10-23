'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { getPeople, getPendingDebts, createPersonPayment } from '@/lib/api'
import type { Account, PendingDebt, Person } from '@/lib/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { DateInput } from '@/components/ui/date-input'

interface CobroFormProps {
  accounts: Account[]
  defaultPersonId?: string
  onDone: () => void
  onCancel: () => void
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')
const inputCls = 'w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-black/40 dark:focus:border-white/40 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30'
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-black/50 dark:text-white/50">{label}</label>
      {children}
    </div>
  )
}

/** Someone paid you back: pick the person, tick what it covers (or just type an amount). */
export default function CobroForm({ accounts, defaultPersonId, onDone, onCancel }: CobroFormProps) {
  const [people, setPeople] = useState<Person[]>([])
  const [personId, setPersonId] = useState<string>(defaultPersonId ?? '')
  const [pending, setPending] = useState<PendingDebt[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [amount, setAmount] = useState<string>('')
  const [amountTouched, setAmountTouched] = useState<boolean>(false)
  const [date, setDate] = useState<string>(todayStr())
  const [accountId, setAccountId] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => { getPeople().then(setPeople).catch(() => {}) }, [])

  useEffect(() => {
    setSelected([])
    setAmount('')
    setAmountTouched(false)
    if (!personId) { setPending([]); return }
    getPendingDebts(personId).then(setPending).catch(() => setPending([]))
  }, [personId])

  const selectedSum = useMemo(
    () => pending.filter(d => selected.includes(d.id)).reduce((a, d) => a + Number(d.pending), 0),
    [pending, selected],
  )
  const pendingTotal = useMemo(() => pending.reduce((a, d) => a + Number(d.pending), 0), [pending])

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    setSelected(next)
    // Follow the ticked items until the amount is typed by hand
    if (!amountTouched) {
      const sum = pending.filter(d => next.includes(d.id)).reduce((a, d) => a + Number(d.pending), 0)
      setAmount(sum > 0 ? String(Math.round(sum * 100) / 100) : '')
    }
  }

  const value = parseFloat(amount) || 0
  const leftover = value - selectedSum
  const depositAccounts = accounts.filter(a => a.account_type !== 'credit_card')

  async function submit() {
    if (!personId) { setError('Elige a la persona'); return }
    if (!(value > 0)) { setError('Escribe cuánto te depositó'); return }
    setSaving(true); setError('')
    try {
      await createPersonPayment(personId, { amount: value, date, account_id: accountId || null, debt_ids: selected, note: note.trim() || undefined })
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="¿Quién te pagó?">
        <CustomSelect
          value={personId}
          onChange={setPersonId}
          placeholder="Elige a la persona"
          options={people.map(p => ({ value: p.id, label: `${p.name}${p.pending_total > 0 ? ` · te debe ${money(Number(p.pending_total))}` : ' · sin pendientes'}` }))}
        />
        {people.length === 0 && <p className="text-[11px] text-black/40 dark:text-white/40">Aún no hay personas. Se agregan al dividir un gasto.</p>}
      </Field>

      {personId && (
        <Field label={pending.length ? `Qué te deben (${money(pendingTotal)})` : 'Qué te deben'}>
          {pending.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl px-3 py-2.5">Esta persona no te debe nada ahora mismo ✓</p>
          ) : (
            <div className="rounded-xl border border-black/10 dark:border-white/10 divide-y divide-black/[0.06] dark:divide-white/[0.08] max-h-56 overflow-y-auto">
              {pending.map(d => {
                const on = selected.includes(d.id)
                return (
                  <button key={d.id} type="button" onClick={() => toggle(d.id)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-black dark:bg-white border-black dark:border-white' : 'border-black/25 dark:border-white/25'}`}>
                      {on && <Check size={11} className="text-white dark:text-black" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-black dark:text-white truncate">{d.description}</span>
                      <span className="block text-[11px] text-black/35 dark:text-white/35">{fmtDate(d.charge_date)}{d.account_name ? ` · ${d.account_name}` : ''}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-black dark:text-white">{money(Number(d.pending))}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>
      )}

      <Field label="¿Cuánto te depositó?">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-black/40 dark:text-white/40">$</span>
          <input
            type="number" step="0.01" placeholder="0.00" value={amount}
            onChange={e => { setAmount(e.target.value); setAmountTouched(true) }}
            className={`${inputCls} pl-7 text-xl font-bold`}
          />
        </div>
        {selected.length > 0 && value > 0 && Math.abs(leftover) > 0.004 && (
          <p className="text-[11px] text-black/50 dark:text-white/50">
            {leftover > 0
              ? `Sobran ${money(leftover)}: se aplican a lo más antiguo que te deba.`
              : `Faltan ${money(-leftover)} para cubrir lo que marcaste; quedará pendiente.`}
          </p>
        )}
        {selected.length === 0 && value > 0 && pending.length > 0 && (
          <p className="text-[11px] text-black/50 dark:text-white/50">Sin marcar nada, se aplica a lo más antiguo que te deba.</p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><DateInput value={date} onChange={setDate} inputClassName={inputCls} /></Field>
        <Field label="Se depositó en">
          <CustomSelect
            value={accountId}
            onChange={setAccountId}
            placeholder="Efectivo / otra"
            options={[{ value: '', label: 'Efectivo / otra' }, ...depositAccounts.map(a => ({ value: a.id, label: a.name }))]}
          />
        </Field>
      </div>
      <p className="text-[10px] text-black/35 dark:text-white/35 -mt-2">Esto no cuenta como ingreso: no sube tu disponible, solo cierra lo que te debían.</p>

      <Field label="Nota (opcional)">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ej. Transferencia SPEI" className={inputCls} />
      </Field>

      {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Cancelar</button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? 'Guardando…' : 'Registrar cobro'}
        </button>
      </div>
    </div>
  )
}
