'use client'
import { useEffect } from 'react'

export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})

    // When connectivity is restored, tell the SW to flush the offline queue.
    // Use serviceWorker.ready instead of .controller — controller can be null
    // right after a SW update even though the SW is active.
    const handleOnline = () => {
      setTimeout(() => {
        navigator.serviceWorker.ready
          .then(reg => reg.active?.postMessage('process-queue'))
          .catch(() => {})
      }, 800)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
