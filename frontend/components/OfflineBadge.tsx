'use client'
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflineBadge() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    setOnline(navigator.onLine)

    const ch = new BroadcastChannel('friday-offline')
    ch.onmessage = e => {
      if (e.data?.type === 'queue-count') setPending(e.data.count)
    }

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ask SW for the current queue count (e.g. if there were pending items from before)
    navigator.serviceWorker?.ready
      .then(reg => reg.active?.postMessage('get-queue-count'))
      .catch(() => {})

    return () => {
      ch.close()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && pending === 0) return null

  const isOffline = !online
  const label = isOffline
    ? pending > 0
      ? `Sin conexión · ${pending} por sincronizar`
      : 'Sin conexión'
    : `Sincronizando ${pending} elemento${pending !== 1 ? 's' : ''}…`

  return (
    <div className={`mx-1 mb-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
      isOffline
        ? 'border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    }`}>
      {isOffline ? <WifiOff size={12} strokeWidth={2} /> : <RefreshCw size={12} strokeWidth={2} className="animate-spin" />}
      <span>{label}</span>
    </div>
  )
}
