'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/login')
      } else {
        setError(data.detail || 'Error al registrarse')
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6B46E5] dark:bg-[#AF9BFF]/15 border border-[#6B46E5]/20 dark:border-[#AF9BFF]/25 mb-4 shadow-lg shadow-[#6B46E5]/20 dark:shadow-[#AF9BFF]/10">
            <span className="text-xl font-bold text-white dark:text-[#AF9BFF]">F</span>
          </div>
          <p className="text-xs text-black/40 dark:text-white/40 mb-1">Crea tu cuenta</p>
          <h1 className="text-2xl font-bold text-black dark:text-white">Únete a FRIDAY</h1>
        </div>

        <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          {error && (
            <div className="mb-4 p-3 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl text-[#FF6B6B] text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nombre completo" required
                className={`${inputCls} pl-10`}
              />
            </div>

            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Correo electrónico" required
                className={`${inputCls} pl-10`}
              />
            </div>

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

            <button
              type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#6B46E5] dark:bg-[#AF9BFF] text-white dark:text-[#0D0D0D] font-semibold rounded-xl py-3 text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {isLoading ? 'Creando cuenta…' : (
                <>Crear cuenta <ArrowRight size={15} /></>
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-sm text-black/40 dark:text-white/40 mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#6B46E5] dark:text-[#AF9BFF] font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
