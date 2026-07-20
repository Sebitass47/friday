'use client'
import { useEffect } from 'react'

export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})

    // When connectivity is restored, tell the SW to flush the offline queue
    const handleOnline = () => {
      navigator.serviceWorker.controller?.postMessage('process-queue')
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
