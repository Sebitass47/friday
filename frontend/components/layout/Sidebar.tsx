'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Sparkles, Moon, Sun, LogOut, Menu, X, CheckSquare, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Finanzas' },
  { href: '/simulador', icon: Sparkles, label: 'Simulador' },
  { href: '/to_do', icon: CheckSquare, label: 'Tareas' },
  { href: '/events', icon: CalendarDays, label: 'Eventos' },
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
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6B46E5] dark:bg-[#AF9BFF]/20 border border-[#6B46E5]/30 dark:border-[#AF9BFF]/30">
          <span className="text-sm font-bold text-white dark:text-[#AF9BFF]">F</span>
        </div>
        <span className="text-base font-semibold text-black dark:text-white tracking-wide">FRIDAY</span>
      </div>

      {/* Nav */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[10px] font-semibold text-black/30 dark:text-white/30 uppercase tracking-widest px-2 mb-2">Espacio</p>
        <nav className="space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10 text-[#6B46E5] dark:text-[#AF9BFF] border border-[#6B46E5]/20 dark:border-[#AF9BFF]/20'
                    : 'text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border border-transparent'
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] p-3 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black/50 dark:text-white/50 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border border-transparent"
        >
          {theme === 'dark' ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black/50 dark:text-white/50 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border border-transparent"
        >
          <LogOut size={17} strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 lg:hidden text-black dark:text-white shadow-sm"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-white/98 dark:bg-[#0D0D0D]/98 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.06] transition-all duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
