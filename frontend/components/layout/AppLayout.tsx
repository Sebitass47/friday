'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { useSidebar } from './SidebarContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const { open } = useSidebar()

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
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0A0A0A]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0A0A0A]">
      <Sidebar />
      <main className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 transition-all duration-300 ${open ? 'lg:ml-60' : 'lg:ml-0'}`}>
        {children}
      </main>
    </div>
  )
}
