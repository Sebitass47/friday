'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const tok = localStorage.getItem('token')
    if (!tok) {
      router.push('/login')
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4F8EF7] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <main className="ml-56 flex-1 min-w-0 p-8">
        {children}
      </main>
    </div>
  )
}
