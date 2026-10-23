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

    // The SW can't always navigate an open window itself (see notificationclick in sw.js): it asks us to.
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        window.location.assign(e.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('online', handleOnline)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
