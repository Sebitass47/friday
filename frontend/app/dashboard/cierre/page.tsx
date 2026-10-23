'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Check, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CobroForm from '@/components/CobroForm'
import { getClosing, getAccounts, setStatementCheck } from '@/lib/api'
import type { Account, Closing, ClosingCard, ClosingPerson } from '@/lib/types'

const money = (n: number) =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')
const GREEN = '#34d399'
const CORAL = '#FF6B6B'

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold tabular-nums mt-1 text-black dark:text-white" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

function PersonRow({ p, onCollect }: { p: ClosingPerson; onCollect: (personId: string) => void }) {
  const done = p.pending <= 0.004
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex-1 min-w-0 text-sm text-black dark:text-white truncate">{p.person_name}</span>
      <span className="text-xs text-black/40 dark:text-white/40 tabular-nums hidden sm:inline">de {money(p.owed)}</span>
      {done ? (
        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: GREEN }}><Check size={13} strokeWidth={3} /> Listo</span>
      ) : (
        <>
          <span className="text-sm font-semibold tabular-nums text-black dark:text-white">{money(p.pending)}</span>
          <button onClick={() => onCollect(p.person_id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity">
            Cobrar
          </button>
        </>
      )}
    </div>
  )
}

function CardPanel({ card, month, year, onCollect, onChanged }: {
  card: ClosingCard; month: number; year: number; onCollect: (personId: string) => void; onChanged: () => void
}) {
  const [open, setOpen] = useState<boolean>(false)
  const [real, setReal] = useState<string>(card.real_total !== null ? String(card.real_total) : '')

  useEffect(() => { setReal(card.real_total !== null ? String(card.real_total) : '') }, [card.real_total, card.account_id, month, year])

  async function saveReal() {
    const v = real.trim() === '' ? null : parseFloat(real)
    if (v !== null && Number.isNaN(v)) return
    if (v === card.real_total) return
    await setStatementCheck({ account_id: card.account_id, month, year, real_total: v })
    onChanged()
  }

  const diff = card.difference
  const matches = diff !== null && Math.abs(diff) < 1
  const toPay = Math.max(card.total - card.paid, 0)

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-black dark:text-white truncate">{card.name}</h2>
          <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">
            Corte {fmtDate(card.period_start)} – {fmtDate(card.period_end)}{card.payment_day ? ` · paga el día ${card.payment_day}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Pagar al banco</p>
          <p className="text-xl font-semibold tabular-nums text-black dark:text-white">{money(toPay)}</p>
          {card.paid > 0 && <p className="text-[11px]" style={{ color: GREEN }}>Ya pagaste {money(card.paid)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { l: 'Tuyo', v: card.mine },
          { l: 'De otros', v: card.others },
          { l: 'De MSI', v: card.msi_total },
        ].map(x => (
          <div key={x.l} className="rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-black/45 dark:text-white/45">{x.l}</p>
            <p className="text-sm font-semibold tabular-nums text-black dark:text-white">{money(x.v)}</p>
          </div>
        ))}
      </div>

      {/* Statement tie-out: type what the bank says and see what's missing */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-black/50 dark:text-white/50">Total del estado de cuenta</label>
        <div className="relative w-36">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-black/40 dark:text-white/40">$</span>
          <input
            type="number" step="0.01" placeholder="0.00" value={real}
            onChange={e => setReal(e.target.value)} onBlur={saveReal}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl pl-6 pr-2 py-1.5 text-sm tabular-nums text-black dark:text-white outline-none focus:border-black/40 dark:focus:border-white/40"
          />
        </div>
        {diff !== null && (
          matches ? (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: GREEN }}><Check size={13} strokeWidth={3} /> Cuadra con el banco</span>
          ) : diff > 0 ? (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: CORAL }}><X size={13} strokeWidth={3} /> Faltan {money(diff)} por registrar en FRIDAY</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: CORAL }}><X size={13} strokeWidth={3} /> FRIDAY tiene {money(-diff)} de más</span>
          )
        )}
      </div>

      {card.people.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Te depositan</p>
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
            {card.people.map(p => <PersonRow key={p.person_id} p={p} onCollect={onCollect} />)}
          </div>
        </div>
      )}

      {card.charges.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
            Movimientos ({card.charges.length})
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {card.charges.map((c, i) => (
                <div key={`${c.kind}-${c.id}-${i}`} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-black dark:text-white truncate">{c.name}</p>
                      <p className="text-[11px] text-black/35 dark:text-white/35">{fmtDate(c.date)}{c.kind === 'installment' ? ' · MSI' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-black dark:text-white">{money(c.total)}</p>
                      {c.shares.length > 0 && <p className="text-[11px] text-black/45 dark:text-white/45 tabular-nums">tuyo {money(c.mine)}</p>}
                    </div>
                  </div>
                  {c.shares.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.shares.map(sh => {
                        const settled = Number(sh.settled) >= Number(sh.amount) - 0.004
                        return (
                          <span key={sh.person_id} className="text-[11px] px-2 py-0.5 rounded-full" style={{
                            background: settled ? 'rgba(52,211,153,0.14)' : 'rgba(127,127,127,0.14)',
                            color: settled ? GREEN : undefined,
                          }}>
                            {sh.person_name} {money(Number(sh.amount))}{settled ? ' ✓' : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function CierrePage() {
  const [data, setData] = useState<Closing | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<boolean>(false)
  const [collect, setCollect] = useState<{ personId?: string } | null>(null)

  const load = useCallback((month?: number, year?: number) => {
    setError(false)
    getClosing(month, year).then(setData).catch(() => setError(true))
  }, [])

  useEffect(() => {
    load()
    getAccounts().then(setAccounts).catch(() => {})
  }, [load])

  function move(delta: number) {
    if (!data) return
    const idx = data.year * 12 + (data.month - 1) + delta
    load((idx % 12) + 1, Math.floor(idx / 12))
  }

  return (
    <AppLayout>
      <div className="max-w-5xl xl:max-w-[1400px] mx-auto pb-24 space-y-5">
        <div className="pt-1">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft size={13} /> Finanzas
          </Link>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Cierre</h1>
              <p className="text-sm text-black/50 dark:text-white/50 mt-0.5">Qué pagar de cada tarjeta y qué te tienen que depositar</p>
            </div>
            <div className="glass rounded-xl flex items-center">
              <button onClick={() => move(-1)} className="p-2.5 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white" aria-label="Estado anterior"><ChevronLeft size={16} /></button>
              <span className="px-2 text-sm font-semibold text-black dark:text-white min-w-[96px] text-center">{data?.label ?? '…'}</span>
              <button onClick={() => move(1)} className="p-2.5 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white" aria-label="Estado siguiente"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="glass rounded-2xl p-5 text-sm text-black/50 dark:text-white/50">No se pudo cargar el cierre. Inténtalo de nuevo.</p>
        ) : !data ? (
          <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse bg-black/5 dark:bg-white/5" />)}</div>
        ) : data.cards.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-black/50 dark:text-white/50">
            Agrega una tarjeta de crédito con su día de corte en Finanzas para ver aquí tu cierre.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Kpi label="Pagar a los bancos" value={money(data.total)} sub="suma de tus tarjetas" />
              <Kpi label="Es tuyo" value={money(data.mine)} />
              <Kpi label="Es de otros" value={money(data.others)} />
              <Kpi
                label="Por cobrar"
                value={data.to_collect > 0.004 ? money(data.to_collect) : 'Todo cobrado'}
                sub={data.to_collect > 0.004 ? 'de este cierre' : undefined}
                color={data.to_collect > 0.004 ? undefined : GREEN}
              />
            </div>

            {data.people.length > 0 && (
              <section className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Personas en este cierre</h2>
                  <button onClick={() => setCollect({})} className="text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white">Registrar cobro</button>
                </div>
                <div className="mt-1 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                  {data.people.map(p => <PersonRow key={p.person_id} p={p} onCollect={id => setCollect({ personId: id })} />)}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">
              {data.cards.map(c => (
                <CardPanel key={c.account_id} card={c} month={data.month} year={data.year}
                  onCollect={id => setCollect({ personId: id })} onChanged={() => load(data.month, data.year)} />
              ))}
            </div>
          </>
        )}
      </div>

      {collect && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setCollect(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-black dark:text-white">Registrar cobro</h2>
              <button onClick={() => setCollect(null)} className="p-1 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"><X size={16} /></button>
            </div>
            <CobroForm
              accounts={accounts}
              defaultPersonId={collect.personId}
              onCancel={() => setCollect(null)}
              onDone={() => { setCollect(null); if (data) load(data.month, data.year); getAccounts().then(setAccounts).catch(() => {}) }}
            />
          </div>
        </div>
      )}
    </AppLayout>
  )
}
