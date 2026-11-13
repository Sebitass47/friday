'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Check, Loader2, ArrowRight, Undo2 } from 'lucide-react'
import { assistantMessage, assistantConfirm, assistantUndo } from '@/lib/api'

interface Done { text: string; href: string | null; undo?: Record<string, unknown> | null; state?: 'undoing' | 'undone' }
interface Turn {
  role: 'user' | 'assistant'
  text: string
  done?: Done[]
  problems?: string[]
}

const EXAMPLES = [
  'Gasté 350 en tacos con la Nu',
  'Agrega Interestelar a mi lista de pelis',
  'Recuérdame pagar la renta el viernes a las 9',
]

/** Circular ✨ button + chat sheet. Whatever you send is saved right away; the reply says what was done and links to it. */
export default function AssistantFab() {
  const [open, setOpen] = useState<boolean>(false)
  const [text, setText] = useState<string>('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [sending, setSending] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const openRef = useRef<boolean>(false)
  const savedRef = useRef<boolean>(false)

  useEffect(() => { openRef.current = open; if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, sending])

  function close() {
    setOpen(false)
    // something was saved while the sheet was open: refresh so the page behind shows it
    if (savedRef.current) { savedRef.current = false; window.location.reload() }
  }

  async function send() {
    const msg = text.trim()
    if (!msg || sending) return
    const history = turns.slice(-6).map(t => ({
      role: t.role,
      text: t.text || (t.done?.map(d => d.text).join('. ') ?? '…'),
    }))
    setText(''); setError(''); setSending(true)
    setTurns(t => [...t, { role: 'user', text: msg }])
    try {
      const r = await assistantMessage(msg, history)
      let reply: Turn
      if (r.actions.length === 0) {
        reply = { role: 'assistant', text: [r.reply, ...r.notes].filter(Boolean).join(' ') }
      } else {
        const c = await assistantConfirm(r.actions)
        if (c.done.length) savedRef.current = true
        reply = {
          role: 'assistant', text: '', done: c.done, problems: [...c.failed, ...r.notes],
        }
      }
      // if the sheet was closed meanwhile it still saved; there is just nothing to show
      if (openRef.current) setTurns(t => [...t, reply])
    } catch (e: unknown) {
      if (openRef.current) { setError(e instanceof Error ? e.message : 'Algo salió mal'); setText(msg) }
    } finally { setSending(false) }
  }

  async function undoDone(turnIdx: number, doneIdx: number) {
    const item = turns[turnIdx]?.done?.[doneIdx]
    if (!item?.undo || item.state) return
    const mark = (state: Done['state'], problem?: string) => setTurns(ts => ts.map((t, i) => i !== turnIdx ? t : {
      ...t,
      done: t.done?.map((d, k) => k === doneIdx ? { ...d, state } : d),
      problems: problem ? [...(t.problems ?? []), problem] : t.problems,
    }))
    mark('undoing')
    try { await assistantUndo(item.undo); mark('undone'); savedRef.current = true }
    catch (e: unknown) { mark(undefined, e instanceof Error ? e.message : 'No se pudo deshacer') }
  }

  function go(href: string) {
    savedRef.current = false
    // full navigation so the page loads fresh data and opens the item (?open=)
    window.location.assign(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Asistente"
        className="fixed bottom-6 right-4 sm:right-6 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl text-white transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
      >
        <Sparkles size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-lg max-h-[88vh] sm:max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 text-black dark:text-white">
                <Sparkles size={18} className="text-violet-500" />
                <h2 className="text-base font-semibold">¿Qué agrego?</h2>
              </div>
              <button onClick={close} aria-label="Cerrar" className="p-2 rounded-xl text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3 min-h-[120px]">
              {turns.length === 0 && (
                <div className="flex flex-col gap-2">
                  {EXAMPLES.map(ex => (
                    <button key={ex} onClick={() => { setText(ex); inputRef.current?.focus() }} className="text-left text-sm px-3.5 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-black/65 dark:text-white/65 hover:bg-black/[0.07] dark:hover:bg-white/10">
                      “{ex}”
                    </button>
                  ))}
                </div>
              )}

              {turns.map((t, i) => t.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 text-white text-sm px-3.5 py-2.5 whitespace-pre-wrap">{t.text}</p>
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  {t.text && <p className="max-w-[92%] rounded-2xl rounded-bl-md text-sm px-3.5 py-2.5 whitespace-pre-wrap bg-black/[0.05] dark:bg-white/[0.07] text-black dark:text-white">{t.text}</p>}
                  {t.done?.map((d, k) => (
                    <div key={k} className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${d.state === 'undone' ? 'bg-black/[0.05] dark:bg-white/[0.06]' : 'bg-emerald-500/10'}`}>
                      <Check size={16} strokeWidth={3} className={`shrink-0 ${d.state === 'undone' ? 'text-black/30 dark:text-white/30' : 'text-emerald-500'}`} />
                      <p className={`flex-1 min-w-0 text-sm ${d.state === 'undone' ? 'line-through text-black/40 dark:text-white/40' : 'text-emerald-700 dark:text-emerald-300'}`}>{d.text}</p>
                      {d.state === 'undone' && <span className="shrink-0 text-xs font-medium text-black/45 dark:text-white/45">Deshecho</span>}
                      {d.undo && d.state !== 'undone' && (
                        <button onClick={() => undoDone(i, k)} disabled={d.state === 'undoing'} aria-label="Deshacer" className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/10 dark:bg-white/10 text-black dark:text-white disabled:opacity-50">
                          {d.state === 'undoing' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Deshacer
                        </button>
                      )}
                      {d.href && d.state !== 'undone' && (
                        <button onClick={() => go(d.href as string)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black text-white dark:bg-white dark:text-black">
                          Ver <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {t.problems?.map((n, k) => <p key={k} className="text-xs text-amber-600 dark:text-amber-400 bg-amber-400/10 rounded-xl px-3 py-2">{n}</p>)}
                </div>
              ))}

              {sending && <p className="text-xs text-black/45 dark:text-white/45 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Trabajando en eso…</p>}
              {error && <p className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 rounded-xl px-3 py-2">{error}</p>}
              <div ref={endRef} />
            </div>

            <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-end gap-2 p-3 pb-4">
              <textarea
                ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={600} rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Escribe o dicta con el micrófono del teclado…"
                className="flex-1 resize-none max-h-32 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl px-4 py-3 text-base text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 outline-none"
              />
              <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar" className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}>
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
