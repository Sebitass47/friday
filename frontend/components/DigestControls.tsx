'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { getDigestSettings, updateDigestSettings, getDigestSummary } from '@/lib/api'
import type { DigestSettings as DigestSettingsData } from '@/lib/types'
import DigestSettings from '@/components/DigestSettings'

type Kind = 'sunday' | 'friday'

const KIND_LABEL: Record<Kind, string> = { sunday: 'Domingo', friday: 'Viernes' }

// JS getDay(): 0 = Sunday … 5 = Friday
function todayKind(): Kind | null {
  const d = new Date().getDay()
  return d === 0 ? 'sunday' : d === 5 ? 'friday' : null
}

function SummaryModal({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const [data, setData] = useState<{ title: string; lines: string[] } | null>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    getDigestSummary(kind).then(setData).catch(() => setError(true))
  }, [kind])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl p-5 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Resumen · {KIND_LABEL[kind]}</p>
            <h2 className="text-lg font-semibold text-black dark:text-white mt-0.5">{data?.title ?? '…'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"><X size={16} /></button>
        </div>

        {error ? (
          <p className="text-sm text-black/50 dark:text-white/50">No se pudo cargar el resumen. Inténtalo de nuevo.</p>
        ) : !data ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse bg-black/5 dark:bg-white/5" />)}</div>
        ) : (
          <ul className="space-y-2">
            {data.lines.map((line, i) => (
              <li key={i} className="rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2.5 text-sm text-black/80 dark:text-white/85 leading-snug">{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Bell (settings) + a "Resumen" button shown only on the days you configured + the summary view.
 *  The push notification links here with ?digest=<kind>. */
export default function DigestControls() {
  const [settings, setSettings] = useState<DigestSettingsData | null>(null)
  const [viewing, setViewing] = useState<Kind | null>(null)

  useEffect(() => {
    getDigestSettings().then(setSettings).catch(() => {})

    const q = new URLSearchParams(window.location.search).get('digest')
    if (q === 'sunday' || q === 'friday') {
      setViewing(q)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  function save(next: DigestSettingsData) {
    setSettings(next)
    updateDigestSettings(next).catch(() => getDigestSettings().then(setSettings))
  }

  const kind = todayKind()
  const showButton = !!settings && settings.enabled && kind !== null && (kind === 'sunday' ? settings.sunday_on : settings.friday_on)

  return (
    <>
      <div className="flex items-center gap-2">
        {showButton && kind && (
          <button
            onClick={() => setViewing(kind)}
            className="glass h-10 px-3.5 rounded-xl flex items-center gap-2 text-sm font-medium text-black/70 dark:text-white/75 hover:text-black dark:hover:text-white transition-colors"
          >
            <ClipboardList size={16} />
            <span>Resumen<span className="hidden sm:inline"> de {kind === 'friday' ? 'hoy' : 'la semana'}</span></span>
          </button>
        )}
        <DigestSettings settings={settings} onSave={save} onView={setViewing} />
      </div>
      {viewing && <SummaryModal kind={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
