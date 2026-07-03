'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Sparkles, Moon, Sun, LogOut, Menu,
  CheckSquare, CalendarDays, Timer, ChevronLeft, StickyNote, Home,
  Bell, BellOff, Download, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import { useSidebar } from './SidebarContext'
import PlanetIcon from '@/components/ui/PlanetIcon'
import { pushSupported, getRegistration, getCurrentSubscription, subscribePush, unsubscribePush } from '@/lib/push'
import { getPushVapidKey, registerPushSubscription, removePushSubscription } from '@/lib/api'

const NAV = [
  { href: '/',          icon: Home,           label: 'Inicio' },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Finanzas' },
  { href: '/to_do',     icon: CheckSquare,    label: 'Tareas' },
  { href: '/events',    icon: CalendarDays,   label: 'Eventos' },
  { href: '/habitos',   icon: Target,         label: 'Hábitos' },
  { href: '/notas',     icon: StickyNote,     label: 'Notas' },
  { href: '/focus',     icon: Timer,          label: 'Focus' },
]

export default function Sidebar({ hideExternalToggle = false }: { hideExternalToggle?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { open, toggle } = useSidebar()

  // Push notifications
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    if (!pushSupported()) return
    getRegistration().then(() => getCurrentSubscription()).then(sub => {
      setPushSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  async function togglePush() {
    if (!pushSupported()) { alert('Tu navegador no soporta notificaciones push'); return }
    setPushLoading(true)
    try {
      if (pushSubscribed) {
        const sub = await getCurrentSubscription()
        if (sub) {
          const p256dh = sub.getKey('p256dh')
          const auth = sub.getKey('auth')
          await removePushSubscription({
            endpoint: sub.endpoint,
            p256dh: p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '',
            auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
          })
          await unsubscribePush()
        }
        setPushSubscribed(false)
      } else {
        const vapidKey = await getPushVapidKey()
        const subData = await subscribePush(vapidKey)
        if (subData) { await registerPushSubscription(subData); setPushSubscribed(true) }
      }
    } catch (e) { console.error('Push toggle error', e) }
    finally { setPushLoading(false) }
  }

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as any) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setInstallPrompt(null) })
    // If already running as standalone, mark as installed
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  function logout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand + collapse button */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]">
            <PlanetIcon size={30} />
          </div>
          <span className="text-xl tracking-tight text-black dark:text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>friday</span>
        </div>
        <button
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-all"
          title="Colapsar menú"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Nav */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[10px] font-semibold text-black/30 dark:text-white/30 uppercase tracking-widest px-2 mb-2">Espacio</p>
        <nav className="space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => { if (window.innerWidth < 1024) toggle() }}
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

      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] p-3 space-y-1">
        {/* Push notifications */}
        {pushSupported() && (
          <button
            onClick={togglePush}
            disabled={pushLoading}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border disabled:opacity-50',
              pushSubscribed
                ? 'bg-[#6B46E5]/10 dark:bg-[#AF9BFF]/10 text-[#6B46E5] dark:text-[#AF9BFF] border-[#6B46E5]/20 dark:border-[#AF9BFF]/20'
                : 'text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border-transparent'
            )}
          >
            {pushSubscribed ? <Bell size={17} strokeWidth={2} /> : <BellOff size={17} strokeWidth={2} />}
            {pushSubscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
          </button>
        )}

        {/* PWA install */}
        {!installed && installPrompt && (
          <button
            onClick={handleInstall}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black/50 dark:text-white/50 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white border border-transparent"
          >
            <Download size={17} strokeWidth={2} />
            Instalar app
          </button>
        )}

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
      {/* Hamburger — visible whenever sidebar is closed, unless page handles its own */}
      {!open && !hideExternalToggle && (
        <button
          onClick={toggle}
          className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 text-black dark:text-white shadow-sm transition-all hover:shadow-md"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Backdrop — only on mobile when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-white/98 dark:bg-[#0D0D0D]/98 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.06] transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
