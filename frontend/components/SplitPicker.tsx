'use client'

import { useMemo, useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import type { Person } from '@/lib/types'
import { ME, computeSplit, type SplitMode, type SplitState } from '@/lib/split'

interface SplitPickerProps {
  /** The full charge (what the bank is charged) */
  total: number
  value: SplitState
  onChange: (next: SplitState) => void
  people: Person[]
  onCreatePerson: (name: string) => Promise<Person>
  /** Wording for the amount being divided, e.g. "este gasto" / "cada pago" */
  subject?: string
}

const MODES: { key: SplitMode; label: string }[] = [
  { key: 'mine', label: 'Todo mío' },
  { key: 'equal', label: 'Dividir' },
  { key: 'custom', label: 'Personalizado' },
  { key: 'other', label: 'De alguien más' },
]

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const inputCls = 'bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-black dark:text-white outline-none focus:border-black/40 dark:focus:border-white/40 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30'

export default function SplitPicker({ total, value, onChange, people, onCreatePerson, subject = 'este gasto' }: SplitPickerProps) {
  const [query, setQuery] = useState<string>('')
  const [adding, setAdding] = useState<boolean>(false)

  const result = useMemo(() => computeSplit(total, value), [total, value])
  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? '…'
  const single = value.mode === 'other'

  const q = query.trim().toLowerCase()
  const suggestions = people.filter(p => !value.people.includes(p.id) && (!q || p.name.toLowerCase().includes(q)))
  const exact = people.find(p => p.name.toLowerCase() === q)
  const canCreate = q.length > 0 && !exact

  function setMode(mode: SplitMode) {
    // Keep what was picked, but "de alguien más" only ever has one person
    onChange({ ...value, mode, people: mode === 'other' ? value.people.slice(0, 1) : value.people })
  }

  function pick(id: string) {
    if (value.people.includes(id)) return
    onChange({ ...value, people: single ? [id] : [...value.people, id] })
    setQuery('')
  }

  function remove(id: string) {
    onChange({ ...value, people: value.people.filter(x => x !== id) })
  }

  async function createAndPick() {
    if (!canCreate || adding) return
    setAdding(true)
    try {
      const p = await onCreatePerson(query.trim())
      pick(p.id)
    } finally {
      setAdding(false)
    }
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (exact) pick(exact.id)
    else if (suggestions.length === 1 && q) pick(suggestions[0].id)
    else void createAndPick()
  }

  const w = (id: string) => (value.weights[id] && value.weights[id] > 0 ? value.weights[id] : 1)
  const setWeight = (id: string, n: number) => onChange({ ...value, weights: { ...value.weights, [id]: Math.max(1, n) } })

  return (
    <div className="space-y-2.5">
      <div className="flex rounded-xl border border-black/10 dark:border-white/10 overflow-hidden p-0.5 bg-black/[0.03] dark:bg-white/[0.03]">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`flex-1 py-1.5 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              value.mode === m.key ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode !== 'mine' && (
        <>
          {/* Selected people */}
          {value.people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.people.map(id => (
                <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-black/[0.07] dark:bg-white/10 text-black dark:text-white">
                  {nameOf(id)}
                  <button type="button" onClick={() => remove(id)} className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/15" aria-label={`Quitar a ${nameOf(id)}`}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Autocomplete: existing people first, or create a new one by typing */}
          {(!single || value.people.length === 0) && (
            <div>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder={single ? '¿De quién es?' : 'Agregar persona…'}
                  className={`${inputCls} flex-1 min-w-0`}
                />
                {canCreate && (
                  <button
                    type="button"
                    onClick={createAndPick}
                    disabled={adding}
                    className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                  >
                    <UserPlus size={13} /> Crear
                  </button>
                )}
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pick(p.id)}
                      className="px-2.5 py-1 rounded-full text-xs border border-black/10 dark:border-white/10 text-black/65 dark:text-white/65 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakdown */}
          {value.people.length > 0 && (
            <div className="rounded-xl border border-black/10 dark:border-white/10 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-black dark:text-white flex items-center gap-2">
                  Tú
                  {value.mode === 'equal' && <Weight n={w(ME)} onChange={n => setWeight(ME, n)} />}
                </span>
                <span className="text-sm font-semibold tabular-nums text-black dark:text-white">{total > 0 ? money(result.mine) : '—'}</span>
              </div>
              {value.people.map(id => {
                const share = result.shares.find(s => s.person_id === id)?.amount ?? 0
                return (
                  <div key={id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm text-black dark:text-white flex items-center gap-2 min-w-0">
                      <span className="truncate">{nameOf(id)}</span>
                      {value.mode === 'equal' && <Weight n={w(id)} onChange={n => setWeight(id, n)} />}
                    </span>
                    {value.mode === 'custom' ? (
                      <input
                        type="number" step="0.01" min={0} placeholder="0.00"
                        value={value.amounts[id] ? value.amounts[id] : ''}
                        onChange={e => onChange({ ...value, amounts: { ...value.amounts, [id]: Number(e.target.value) || 0 } })}
                        className={`${inputCls} w-28 text-right py-1`}
                      />
                    ) : (
                      <span className="text-sm font-semibold tabular-nums text-black dark:text-white">{total > 0 ? money(share) : '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {value.mode === 'equal' && value.people.length > 0 && (
            <p className="text-[10px] text-black/35 dark:text-white/35">Las “partes” reparten {subject}: con 2 y 1, tú pagas 2/3 y la otra persona 1/3.</p>
          )}
          {result.error && value.people.length > 0 && (
            <p className="text-[11px] text-red-500 bg-red-500/10 rounded-lg px-2.5 py-1.5">{result.error}</p>
          )}
          {total > 0 && value.people.length > 0 && !result.error && result.shares.length > 0 && (
            <p className="text-[11px] text-black/50 dark:text-white/50">
              El banco cobra {money(total)}; ellos te deben {money(result.shares.reduce((a, s) => a + s.amount, 0))}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Weight({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 text-[11px] overflow-hidden">
      <button type="button" onClick={() => onChange(n - 1)} className="px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Menos">−</button>
      <span className="px-1.5 tabular-nums text-black/60 dark:text-white/60">{n} {n === 1 ? 'parte' : 'partes'}</span>
      <button type="button" onClick={() => onChange(n + 1)} className="px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Más">+</button>
    </span>
  )
}
