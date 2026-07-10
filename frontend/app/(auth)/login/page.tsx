'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import PlanetIcon from '@/components/ui/PlanetIcon'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('username', email)
      formData.append('password', password)

      const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1'
      const response = await fetch(`${BASE}/auth/login?remember_me=${rememberMe}`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.access_token)
        router.push('/dashboard')
      } else {
        setError(typeof data.detail === 'string' ? data.detail : 'Error al iniciar sesión')
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputCls = 'w-full bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-[#6B46E5] dark:focus:border-[#AF9BFF] transition-colors'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0D0D0D]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-0 drop-shadow-[0_0_32px_rgba(124,58,237,0.45)]">
            <PlanetIcon size={88} />
          </div>
          <span className="text-3xl tracking-tight text-black dark:text-white mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>friday</span>
          <p className="text-xs text-black/40 dark:text-white/40 mb-1">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-bold text-black dark:text-white">Entra a tu espacio</h1>
        </div>

        {/* Card */}
        <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          {error && (
            <div className="mb-4 p-3 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl text-[#FF6B6B] text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Correo electrónico" required
                className={`${inputCls} pl-10`}
              />
            </div>

            <div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Contraseña" required
                  className={`${inputCls} pl-10 pr-10`}
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <span className="text-xs text-black/40 dark:text-white/40 cursor-pointer hover:text-[#6B46E5] dark:hover:text-[#AF9BFF] transition-colors">
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${rememberMe ? 'bg-[#6B46E5] dark:bg-[#AF9BFF] border-[#6B46E5] dark:border-[#AF9BFF]' : 'border-black/20 dark:border-white/20 bg-transparent'}`}
              >
                {rememberMe && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span onClick={() => setRememberMe(!rememberMe)} className="text-xs text-black/50 dark:text-white/50">
                Recordar este dispositivo (30 días)
              </span>
            </label>

            <button
              type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#6B46E5] dark:bg-[#AF9BFF] text-white dark:text-[#0D0D0D] font-semibold rounded-xl py-3 text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {isLoading ? 'Entrando…' : (
                <>Entrar <ArrowRight size={15} /></>
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-sm text-black/40 dark:text-white/40 mt-5">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-[#6B46E5] dark:text-[#AF9BFF] font-semibold hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
