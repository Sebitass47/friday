'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Check, Loader2, AlertTriangle } from 'lucide-react'
import { assistantMessage, assistantConfirm } from '@/lib/api'

interface Turn { role: 'user' | 'assistant'; text: string }
interface Toast { kind: 'working' | 'ok' | 'warn' | 'error'; lines: string[]; problems?: string[] }

const TOAST_KEY = 'friday_assistant_toast'
const EXAMPLES = [
  'Gasté 350 en tacos con la Nu',
  'Agrega Interestelar a mi lista de pelis',
  'Recuérdame pagar la renta el viernes a las 9',
]

/** Circular ✨ button + input sheet. Whatever you send is saved right away and a toast says what was done. */
export default function AssistantFab() {
  const [open, setOpen] = useState<boolean>(false)
  const [text, setText] = useState<string>('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // the page reloads after saving (so it shows the new data); the toast survives the reload
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOAST_KEY)
      if (raw) { sessionStorage.removeItem(TOAST_KEY); show(JSON.parse(raw) as Toast) }
    } catch { /* storage unavailable */ }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  function show(t: Toast | null, ms = 8000) {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    if (t && t.kind !== 'working') timer.current = setTimeout(() => setToast(null), ms)
  }

  async function send() {
    const msg = text.trim()
    if (!msg) return
    const history = turns.slice(-6)
    setText(''); setOpen(false)
    show({ kind: 'working', lines: ['Procesando…'] })
    try {
      const r = await assistantMessage(msg, history)
      if (r.actions.length === 0) {
        // a question, a refusal or nothing understood: keep talking in the sheet
        setTurns([...history, { role: 'user', text: msg }, { role: 'assistant', text: [r.reply, ...r.notes].filter(Boolean).join(' ') }])
        show(null); setOpen(true)
        return
      }
      const c = await assistantConfirm(r.actions)
      setTurns([])
      const problems = [...c.failed, ...r.notes]
      const result: Toast = { kind: c.done.length ? (problems.length ? 'warn' : 'ok') : 'error', lines: c.done, problems }
      if (c.done.length) {
        try { sessionStorage.setItem(TOAST_KEY, JSON.stringify(result)) } catch { /* ignore */ }
        window.location.reload()
      } else {
        show(result, 10000)
      }
    } catch (e: unknown) {
      setText(msg)
      show({ kind: 'error', lines: [e instanceof Error ? e.message : 'Algo salió mal'] }, 9000)
    }
  }

  const last = turns.length > 0 ? turns[turns.length - 1] : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Asistente"
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl text-white transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
      >
        <Sparkles size={26} />
      </button>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm">
          <div className="glass rounded-2xl px-4 py-3 shadow-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#141414]/90 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {toast.kind === 'working' ? <Loader2 size={18} className="animate-spin text-violet-500" />
                  : toast.kind === 'ok' ? <Check size={18} strokeWidth={3} className="text-emerald-500" />
                  : <AlertTriangle size={18} className={toast.kind === 'error' ? 'text-[#FF6B6B]' : 'text-amber-500'} />}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                {toast.lines.map((l, i) => <p key={i} className="text-sm text-black dark:text-white">{l}</p>)}
                {toast.problems?.map((l, i) => <p key={`p${i}`} className="text-xs text-amber-600 dark:text-amber-400">{l}</p>)}
              </div>
              {toast.kind !== 'working' && (
                <button onClick={() => show(null)} aria-label="Cerrar aviso" className="shrink-0 p-1 -m-1 text-black/40 dark:text-white/40"><X size={16} /></button>
              )}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 text-black dark:text-white">
                <Sparkles size={18} className="text-violet-500" />
                <h2 className="text-base font-semibold">¿Qué agrego?</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="p-2 rounded-xl text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"><X size={20} /></button>
            </div>

            <div className="px-4 pb-2 space-y-2">
              {last && last.role === 'assistant' ? (
                <p className="text-sm rounded-2xl bg-black/[0.05] dark:bg-white/[0.07] text-black dark:text-white px-3.5 py-2.5">{last.text}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {EXAMPLES.map(ex => (
                    <button key={ex} onClick={() => { setText(ex); inputRef.current?.focus() }} className="text-left text-sm px-3.5 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-black/65 dark:text-white/65 hover:bg-black/[0.07] dark:hover:bg-white/10">
                      “{ex}”
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-end gap-2 p-3 pb-4">
              <textarea
                ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={600} rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Escribe o dicta con el micrófono del teclado…"
                className="flex-1 resize-none max-h-32 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl px-4 py-3 text-base text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35 outline-none"
              />
              <button type="submit" disabled={!text.trim()} aria-label="Enviar" className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}>
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
