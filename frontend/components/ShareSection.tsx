'use client'

import { useEffect, useState } from 'react'
import { X, UserPlus, Users, LogOut } from 'lucide-react'
import { getContacts, lookupUser, shareResource, unshareResource } from '@/lib/api'
import type { ShareableType } from '@/lib/api'
import type { SharedUser } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  resourceType: ShareableType
  // Undefined while the item is being created (people are collected in `pending` until it's saved)
  resourceId?: string
  isOwner?: boolean
  ownerName?: string | null
  sharedWith?: SharedUser[]
  pending?: SharedUser[]
  onPendingChange?: (people: SharedUser[]) => void
  meId?: string
  onSharedChange?: (sharedWith: SharedUser[]) => void
  onLeft?: () => void
}

const labelCls = 'text-[11px] font-extrabold text-black/30 dark:text-white/30 uppercase tracking-widest mb-2'

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/15 text-[10px] font-bold flex items-center justify-center text-black/70 dark:text-white/80 flex-shrink-0">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export default function ShareSection({
  resourceType, resourceId, isOwner = true, ownerName, sharedWith = [], pending = [],
  onPendingChange, meId, onSharedChange, onLeft,
}: Props) {
  const [contacts, setContacts] = useState<SharedUser[]>([])
  const [email, setEmail] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [confirmLeave, setConfirmLeave] = useState<boolean>(false)

  const people = resourceId ? sharedWith : pending

  useEffect(() => { getContacts().then(setContacts).catch(() => {}) }, [])

  async function add(user: SharedUser) {
    if (people.some(p => p.id === user.id)) return
    setError('')
    setBusy(true)
    try {
      if (resourceId) {
        const res = await shareResource(resourceType, resourceId, user.email)
        onSharedChange?.(res.shared_with)
        getContacts().then(setContacts).catch(() => {})
      } else {
        onPendingChange?.([...pending, user])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir')
    } finally {
      setBusy(false)
    }
  }

  async function addByEmail() {
    const value = email.trim()
    if (!value) return
    setError('')
    setBusy(true)
    try {
      const user = await lookupUser(value)
      setEmail('')
      setBusy(false)
      await add(user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se encontró ese correo')
      setBusy(false)
    }
  }

  async function remove(user: SharedUser) {
    setError('')
    if (!resourceId) {
      onPendingChange?.(pending.filter(p => p.id !== user.id))
      return
    }
    try {
      const res = await unshareResource(resourceType, resourceId, user.id)
      onSharedChange?.(res.shared_with)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar')
    }
  }

  async function leave() {
    if (!resourceId || !meId) return
    if (!confirmLeave) {
      setConfirmLeave(true)
      setTimeout(() => setConfirmLeave(false), 2500)
      return
    }
    try {
      await unshareResource(resourceType, resourceId, meId)
      onLeft?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo salir')
    }
  }

  // Shared with me by someone else: can't manage who sees it, only leave
  if (resourceId && !isOwner) {
    const others = sharedWith.filter(p => p.id !== meId)
    return (
      <div>
        <p className={labelCls}>Compartido</p>
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-black/70 dark:text-white/70">
            <Users size={14} className="flex-shrink-0" />
            <span>Lo compartió contigo <strong className="font-semibold">{ownerName ?? 'alguien'}</strong></span>
          </div>
          {others.length > 0 && (
            <p className="text-[11px] text-black/40 dark:text-white/40">También con: {others.map(o => o.name).join(', ')}</p>
          )}
          <button
            onClick={leave}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors',
              confirmLeave ? 'bg-red-500/15 text-red-500' : 'text-black/50 dark:text-white/50 hover:text-red-500 hover:bg-red-500/10'
            )}
          >
            <LogOut size={12} /> {confirmLeave ? 'Toca otra vez para confirmar' : 'Dejar de ver'}
          </button>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
      </div>
    )
  }

  const suggestions = contacts.filter(c => !people.some(p => p.id === c.id))

  return (
    <div>
      <p className={labelCls}>Compartir con</p>

      {people.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {people.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-black/[0.06] dark:bg-white/10 border border-black/10 dark:border-white/10 text-xs text-black/80 dark:text-white/85">
              <Avatar name={p.name} />
              {p.name}
              <button onClick={() => remove(p)} className="text-black/30 dark:text-white/40 hover:text-red-500 transition-colors" title="Quitar">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-black/30 dark:text-white/30 mb-1">Sugeridos</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(c => (
              <button
                key={c.id}
                onClick={() => add(c)}
                disabled={busy}
                title={c.email}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-dashed border-black/20 dark:border-white/20 text-xs text-black/60 dark:text-white/60 hover:border-black/50 dark:hover:border-white/50 hover:text-black dark:hover:text-white disabled:opacity-50 transition-all"
              >
                <Avatar name={c.name} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addByEmail() } }}
          placeholder="Correo de la persona…"
          className="flex-1 min-w-0 text-[13px] bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-black/40 dark:focus:border-white/40 transition-colors"
        />
        <button
          onClick={addByEmail}
          disabled={!email.trim() || busy}
          className="p-2 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-30 transition-opacity"
          title="Compartir"
        >
          <UserPlus size={16} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
      {!resourceId && people.length > 0 && (
        <p className="text-[10px] text-black/30 dark:text-white/30 mt-1.5">Se compartirá al crearlo.</p>
      )}
    </div>
  )
}
