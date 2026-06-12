'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, RefreshCw, Package, Target,
  Settings, Sparkles, LogOut, Menu, X, Moon, Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'

const NAV = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cuentas',       icon: CreditCard,       label: 'Cuentas' },
  { href: '/recurrentes',   icon: RefreshCw,        label: 'Recurrentes' },
  { href: '/msi',           icon: Package,          label: 'MSI' },
  { href: '/metas',         icon: Target,           label: 'Metas' },
  { href: '/simulador',     icon: Sparkles,         label: 'Simulador' },
  { href: '/configuracion', icon: Settings,         label: 'Configuración' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  function logout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-black/10 dark:from-white/10 to-black/5 dark:to-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
          <span className="text-sm font-bold text-black dark:text-white">F</span>
        </div>
        <span className="text-base font-semibold text-black dark:text-white tracking-wide">FRIDAY</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-lg'
                  : 'text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border border-transparent'
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle + Logout */}
      <div className="border-t border-white/[0.06] dark:border-white/[0.06] border-black/[0.06] p-3 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-black/60 dark:text-white/60 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-black/60 dark:text-white/60 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
        >
          <LogOut size={18} strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-[#2A2A2A] lg:hidden text-black dark:text-white"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white/95 dark:bg-[#0D0D0D]/95 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.06] transition-all duration-300",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
