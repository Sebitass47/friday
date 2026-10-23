'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Send } from 'lucide-react'
import { getDigestSettings, updateDigestSettings, sendDigestTest } from '@/lib/api'
import type { DigestSettings as DigestSettingsData } from '@/lib/types'
import { CustomSelect } from '@/components/ui/custom-select'

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-black dark:bg-white' : 'bg-black/15 dark:bg-white/15'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white dark:bg-black ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function DigestSettings() {
  const [open, setOpen] = useState<boolean>(false)
  const [settings, setSettings] = useState<DigestSettingsData | null>(null)
  const [preview, setPreview] = useState<{ title: string; body: string; sent: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (open && !settings) getDigestSettings().then(setSettings).catch(() => {})
  }, [open, settings])

  function save(next: DigestSettingsData) {
    setSettings(next)
    updateDigestSettings(next).catch(() => getDigestSettings().then(setSettings))
  }

  async function test(kind: 'sunday' | 'friday') {
    setBusy(kind)
    try {
      setPreview(await sendDigestTest(kind))
    } catch {
      setPreview({ title: 'No se pudo generar', body: 'Inténtalo de nuevo.', sent: 0 })
    } finally {
      setBusy(null)
    }
  }

  const rows: { kind: 'sunday' | 'friday'; label: string; hint: string; onKey: 'sunday_on' | 'friday_on'; hourKey: 'sunday_hour' | 'friday_hour' }[] = [
    { kind: 'sunday', label: 'Domingo', hint: 'Tu semana: eventos, recordatorios, pagos y cuánto te queda', onKey: 'sunday_on', hourKey: 'sunday_hour' },
    { kind: 'friday', label: 'Viernes', hint: 'Qué hay hoy y el fin de semana, tus hábitos y cuánto te queda', onKey: 'friday_on', hourKey: 'friday_hour' },
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Resumen semanal"
        aria-label="Resumen semanal"
        className="glass w-10 h-10 rounded-xl flex items-center justify-center text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
      >
        <Bell size={17} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl p-5 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-black dark:text-white">Resumen semanal</h2>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Te llega como notificación push.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"><X size={16} /></button>
            </div>

            {!settings ? (
              <div className="h-24 rounded-xl animate-pulse bg-black/5 dark:bg-white/5" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black dark:text-white">Recibir resumen</span>
                  <Toggle on={settings.enabled} onChange={v => save({ ...settings, enabled: v })} />
                </div>

                {rows.map(r => (
                  <div key={r.kind} className={`rounded-xl border border-black/10 dark:border-white/10 p-3 space-y-2 transition-opacity ${settings.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-black dark:text-white">{r.label}</p>
                        <p className="text-[11px] text-black/45 dark:text-white/45 leading-snug">{r.hint}</p>
                      </div>
                      <Toggle on={settings[r.onKey]} onChange={v => save({ ...settings, [r.onKey]: v })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <CustomSelect
                        className="w-28"
                        value={String(settings[r.hourKey])}
                        onChange={v => save({ ...settings, [r.hourKey]: Number(v) })}
                        options={HOURS}
                      />
                      <button
                        onClick={() => test(r.kind)}
                        disabled={busy !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <Send size={12} /> {busy === r.kind ? 'Generando…' : 'Enviarme uno ahora'}
                      </button>
                    </div>
                  </div>
                ))}

                {preview && (
                  <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">
                      Vista previa {preview.sent === 0 ? '· sin notificaciones activadas en este dispositivo' : ''}
                    </p>
                    <p className="text-sm font-semibold text-black dark:text-white">{preview.title}</p>
                    <p className="text-xs text-black/70 dark:text-white/70 whitespace-pre-line mt-1">{preview.body}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
