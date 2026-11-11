'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Check, Loader2 } from 'lucide-react'
import { assistantMessage, assistantConfirm } from '@/lib/api'
import type { AssistantAction } from '@/lib/api'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  actions?: AssistantAction[]
  notes?: string[]
  state?: 'pending' | 'saving' | 'saved' | 'discarded'
  failed?: string[]
}

const EXAMPLES = [
  'Gasté 350 en tacos con la Nu',
  'Agrega Interestelar a mi lista de pelis',
  'Recuérdame pagar la renta el viernes a las 9',
]

export default function AssistantSheet({ shiftRight }: { shiftRight: boolean }) {
  const [open, setOpen] = useState<boolean>(false)
  const [text, setText] = useState<string>('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [sending, setSending] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [saved, setSaved] = useState<boolean>(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, sending])

  function close() {
    setOpen(false)
    // show what was just saved on whatever page the user is looking at
    if (saved) window.location.reload()
  }

  async function send(raw?: string) {
    const msg = (raw ?? text).trim()
    if (!msg || sending) return
    setText(''); setError(''); setSending(true)
    const history = turns.slice(-6).map(t => ({ role: t.role, text: t.text || (t.actions?.length ? 'Propuse acciones.' : '…') }))
    setTurns(t => [...t, { role: 'user', text: msg }])
    try {
      const r = await assistantMessage(msg, history)
      setTurns(t => [...t, {
        role: 'assistant', text: r.reply, actions: r.actions, notes: r.notes,
        state: r.actions.length ? 'pending' : undefined,
      }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setSending(false) }
  }

  async function confirm(i: number) {
    const turn = turns[i]
    if (!turn.actions) return
    setTurns(t => t.map((x, j) => j === i ? { ...x, state: 'saving' } : x))
    try {
      const r = await assistantConfirm(turn.actions)
      if (r.done.length) setSaved(true)
      setTurns(t => t.map((x, j) => j === i ? { ...x, state: 'saved', text: r.done.join(' · '), failed: r.failed } : x))
    } catch (e: unknown) {
      setTurns(t => t.map((x, j) => j === i ? { ...x, state: 'pending' } : x))
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Asistente"
        className={`fixed bottom-5 z-30 h-14 w-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-violet-900/30 active:scale-95 transition-all ${shiftRight ? 'left-5 lg:left-[17rem]' : 'left-5'}`}
      >
        <Sparkles size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-lg h-[85vh] sm:h-[70vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2 text-black dark:text-white">
                <Sparkles size={18} className="text-violet-500" />
                <h2 className="text-base font-semibold">Asistente</h2>
              </div>
              <button onClick={close} aria-label="Cerrar" className="p-2 rounded-xl text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {turns.length === 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-black/60 dark:text-white/55">Dime o dicta (con el micrófono de tu teclado) lo que quieres registrar: gastos, recordatorios, eventos y listas.</p>
                  <div className="flex flex-col gap-2">
                    {EXAMPLES.map(ex => (
                      <button key={ex} onClick={() => setText(ex)} className="text-left text-sm px-3.5 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-black/70 dark:text-white/70 hover:bg-black/[0.07] dark:hover:bg-white/10">
                        “{ex}”
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) => t.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 text-white text-sm px-3.5 py-2.5 whitespace-pre-wrap">{t.text}</p>
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  {t.text && (
                    <p className={`max-w-[90%] rounded-2xl rounded-bl-md text-sm px-3.5 py-2.5 whitespace-pre-wrap ${t.state === 'saved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black dark:text-white'}`}>
                      {t.state === 'saved' && <Check size={14} className="inline mr-1 -mt-0.5" strokeWidth={3} />}{t.text}
                    </p>
                  )}
                  {t.notes?.map((n, k) => <p key={k} className="text-xs text-amber-600 dark:text-amber-400 bg-amber-400/10 rounded-xl px-3 py-2">{n}</p>)}
                  {t.failed?.map((n, k) => <p key={k} className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 rounded-xl px-3 py-2">{n}</p>)}
                  {t.state && t.state !== 'saved' && t.state !== 'discarded' && t.actions?.map((a, k) => (
                    <div key={k} className="rounded-2xl border border-black/10 dark:border-white/10 px-4 py-3">
                      <p className="text-sm font-semibold text-black dark:text-white">{a.title}</p>
                      {a.lines.map((l, m) => <p key={m} className="text-xs text-black/55 dark:text-white/55 mt-0.5">{l}</p>)}
                    </div>
                  ))}
                  {t.state === 'pending' || t.state === 'saving' ? (
                    <div className="flex gap-2">
                      <button onClick={() => confirm(i)} disabled={t.state === 'saving'} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-black text-white dark:bg-white dark:text-black disabled:opacity-60">
                        {t.state === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />} Guardar
                      </button>
                      <button onClick={() => setTurns(ts => ts.map((x, j) => j === i ? { ...x, state: 'discarded', text: 'Descartado' } : x))} disabled={t.state === 'saving'} className="flex-1 py-3 rounded-xl text-sm font-medium border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60">
                        Descartar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {sending && <p className="text-xs text-black/40 dark:text-white/40 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Pensando…</p>}
              {error && <p className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 rounded-xl px-3 py-2">{error}</p>}
              <div ref={endRef} />
            </div>

            <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-end gap-2 p-3 border-t border-black/[0.06] dark:border-white/[0.08]">
              <textarea
                value={text} onChange={e => setText(e.target.value)} maxLength={600} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Escribe o dicta…"
                className="flex-1 resize-none max-h-32 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl px-4 py-3 text-base text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 outline-none"
              />
              <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar" className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-violet-600 text-white disabled:opacity-40">
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
