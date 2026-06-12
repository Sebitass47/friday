'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, RefreshCw, Package, Target,
  Settings, Sparkles, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

  function logout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 flex w-56 flex-col bg-[#0D0D0D] border-r border-white/[0.06] z-20">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4F8EF7]">
          <span className="text-xs font-bold text-white">F</span>
        </div>
        <span className="text-base font-semibold text-white tracking-wide">FRIDAY</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[#4F8EF7]/15 text-[#4F8EF7]'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
