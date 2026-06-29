'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface SidebarCtx { open: boolean; toggle: () => void; setOpen: (v: boolean) => void }

const Ctx = createContext<SidebarCtx>({ open: true, toggle: () => {}, setOpen: () => {} })

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    // closed by default on mobile
    if (window.innerWidth < 1024) setOpen(false)
  }, [])
  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen(o => !o), setOpen }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
