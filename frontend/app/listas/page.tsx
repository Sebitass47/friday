'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import {
  getLists, createList, updateList, deleteList,
  addListItem, updateListItem, deleteListItem, clearCompletedListItems, getMe, shareResource,
} from '@/lib/api'
import type { UserList, User, SharedUser } from '@/lib/types'
import ShareSection from '@/components/ShareSection'
import { Search, Plus, X, Trash2, Check, ListChecks, Pencil, Eraser, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMOJIS = [
  '📝', '🛒', '🎬', '📚', '🎮', '🎵', '✈️', '🍽️', '🍿', '🏠',
  '💡', '🎁', '💪', '🧴', '🧹', '🛠️', '💻', '📺', '🍕', '☕',
  '🥑', '🐶', '🌱', '🎒', '🧳', '💊', '🎨', '📷', '⚽', '🎲',
]

const firstGrapheme = (v: string) => {
  const t = v.trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(t))[0]?.segment ?? ''
  }
  return Array.from(t)[0] ?? ''
}

const sortByRecent = (ls: UserList[]) =>
  [...ls].sort((a, b) => b.updated_at.localeCompare(a.updated_at))

const progress = (l: UserList) => {
  const total = l.items.length
  const done = l.items.filter(i => i.is_done).length
  return { total, done, pending: total - done, pct: total ? (done / total) * 100 : 0 }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PanelProps {
  list: UserList | null
  creating: boolean
  onClose: () => void
  onCreate: (name: string, emoji: string, shareEmails: string[]) => Promise<void>
  meId?: string
  onSharedChange: (id: string, sharedWith: SharedUser[]) => void
  onLeft: (id: string) => void
  onRename: (id: string, data: { name?: string; emoji?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddItem: (id: string, text: string) => Promise<void>
  onToggleItem: (id: string, itemId: string, done: boolean) => Promise<void>
  onEditItem: (id: string, itemId: string, text: string) => Promise<void>
  onRemoveItem: (id: string, itemId: string) => Promise<void>
  onClearDone: (id: string) => Promise<void>
}

function ListPanel({
  list, creating, onClose, onCreate, meId, onSharedChange, onLeft, onRename, onDelete,
  onAddItem, onToggleItem, onEditItem, onRemoveItem, onClearDone,
}: PanelProps) {
  const [name, setName] = useState(list?.name ?? '')
  const [emoji, setEmoji] = useState(list?.emoji ?? '📝')
  const [showEmojis, setShowEmojis] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingShare, setPendingShare] = useState<SharedUser[]>([])

  const panelLabel = 'text-[11px] font-extrabold text-black/30 dark:text-white/30 uppercase tracking-widest mb-2'
  const pending = list?.items.filter(i => !i.is_done) ?? []
  const done = list?.items.filter(i => i.is_done) ?? []
  const p = list ? progress(list) : null

  async function pickEmoji(e: string) {
    setEmoji(e)
    setShowEmojis(false)
    if (list) await onRename(list.id, { emoji: e })
  }

  async function commitName() {
    if (!list) return
    const n = name.trim()
    if (!n) { setName(list.name); return }
    if (n !== list.name) await onRename(list.id, { name: n })
  }

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try { await onCreate(name.trim(), emoji, pendingShare.map(p => p.email)) } finally { setSaving(false) }
  }

  async function handleAdd() {
    const t = newItem.trim()
    if (!t || !list) return
    setNewItem('')
    await onAddItem(list.id, t)
  }

  async function commitEdit(itemId: string) {
    const t = editText.trim()
    setEditingId(null)
    if (list && t) await onEditItem(list.id, itemId, t)
  }

  return (
    <div className="flex flex-col bg-white dark:bg-[#141414] rounded-t-2xl lg:rounded-none border-t border-black/[0.06] dark:border-white/[0.08] lg:border-t-0 lg:border-l lg:h-full lg:w-80 lg:min-w-[300px] max-h-[88dvh] lg:max-h-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <span className="text-[14px] font-bold text-black/80 dark:text-white/80">{creating ? 'Nueva lista' : 'Lista'}</span>
        <div className="flex gap-1">
          {!creating && list && list.is_owner && (
            <button
              onClick={() => { if (confirmDelete) onDelete(list.id); else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 2500) } }}
              className={cn('p-1.5 rounded-lg transition-colors', confirmDelete ? 'bg-red-500/15 text-red-500' : 'text-red-500 dark:text-red-400 hover:bg-red-500/10')}
              title={confirmDelete ? 'Toca otra vez para borrar' : 'Borrar lista'}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Emoji + name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEmojis(v => !v)}
            className="w-12 h-12 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-2xl flex items-center justify-center flex-shrink-0 hover:bg-black/[0.07] dark:hover:bg-white/10 transition-colors"
            title="Cambiar emoji"
          >
            {emoji}
          </button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commitName}
            placeholder="Nombre de la lista"
            autoFocus={creating}
            className="flex-1 min-w-0 bg-transparent text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 text-[19px] font-bold outline-none border-b border-black/10 dark:border-white/10 pb-2 focus:border-black/40 dark:focus:border-white/40 transition-colors"
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              if (creating) handleCreate()
              else (e.target as HTMLInputElement).blur()
            }}
          />
        </div>

        {showEmojis && (
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 space-y-2">
            <div className="grid grid-cols-10 gap-1">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => pickEmoji(e)}
                  className={cn('aspect-square text-lg rounded-lg flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/10 transition-colors', emoji === e && 'bg-black/[0.08] dark:bg-white/15')}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              placeholder="…o escribe/pega el tuyo"
              onChange={e => { const g = firstGrapheme(e.target.value); if (g) pickEmoji(g); e.target.value = '' }}
              className="w-full text-xs bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-black/40 dark:focus:border-white/40"
            />
          </div>
        )}

        <ShareSection
          resourceType="list"
          resourceId={creating ? undefined : list?.id}
          isOwner={list?.is_owner ?? true}
          ownerName={list?.owner_name}
          sharedWith={list?.shared_with ?? []}
          pending={pendingShare}
          onPendingChange={setPendingShare}
          meId={meId}
          onSharedChange={sw => list && onSharedChange(list.id, sw)}
          onLeft={() => list && onLeft(list.id)}
        />

        {creating ? (
          <p className="text-xs text-black/40 dark:text-white/40 leading-relaxed">
            Ponle nombre y emoji. Después de crearla podrás agregar los elementos.
          </p>
        ) : list && p && (
          <>
            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className={panelLabel + ' mb-0'}>Elementos</p>
                <span className="text-[11px] font-bold tabular-nums text-black/40 dark:text-white/40">{p.done}/{p.total}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-black/[0.07] dark:bg-white/[0.08] overflow-hidden">
                <div className="h-full rounded-full bg-black/70 dark:bg-white/75 transition-all duration-300" style={{ width: `${p.pct}%` }} />
              </div>
            </div>

            {/* Add */}
            <div className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Agregar elemento…"
                className="flex-1 min-w-0 text-[13px] bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-black/40 dark:focus:border-white/40 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!newItem.trim()}
                className="p-2 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-30 transition-opacity"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Items */}
            {p.total === 0 ? (
              <p className="text-center text-xs text-black/30 dark:text-white/30 py-4">Aún no hay elementos. Escribe el primero arriba.</p>
            ) : (
              <div className="space-y-0.5">
                {pending.map(item => (
                  <ItemRow key={item.id} {...{ item, editingId, editText, setEditText }}
                    onToggle={() => onToggleItem(list.id, item.id, true)}
                    onStartEdit={() => { setEditingId(item.id); setEditText(item.text) }}
                    onCommit={() => commitEdit(item.id)}
                    onRemove={() => onRemoveItem(list.id, item.id)} />
                ))}
                {done.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-3 pb-1">
                      <p className={panelLabel + ' mb-0'}>Completados ({done.length})</p>
                      <button onClick={() => onClearDone(list.id)} className="flex items-center gap-1 text-[11px] font-semibold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                        <Eraser size={12} /> Limpiar
                      </button>
                    </div>
                    {done.map(item => (
                      <ItemRow key={item.id} {...{ item, editingId, editText, setEditText }}
                        onToggle={() => onToggleItem(list.id, item.id, false)}
                        onStartEdit={() => { setEditingId(item.id); setEditText(item.text) }}
                        onCommit={() => commitEdit(item.id)}
                        onRemove={() => onRemoveItem(list.id, item.id)} />
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {creating && (
        <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-2.5 rounded-xl bg-black dark:bg-white disabled:opacity-40 text-white dark:text-black text-sm font-medium transition-opacity"
          >
            {saving ? 'Creando...' : 'Crear lista'}
          </button>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, editingId, editText, setEditText, onToggle, onStartEdit, onCommit, onRemove }: {
  item: UserList['items'][number]
  editingId: string | null
  editText: string
  setEditText: (v: string) => void
  onToggle: () => void
  onStartEdit: () => void
  onCommit: () => void
  onRemove: () => void
}) {
  const editing = editingId === item.id
  return (
    <div className="group flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
      <button
        onClick={onToggle}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          item.is_done
            ? 'bg-neutral-800 border-neutral-800 dark:bg-white dark:border-white'
            : 'border-black/25 dark:border-white/25 hover:border-black/60 dark:hover:border-white/60'
        )}
      >
        {item.is_done && <Check size={11} className="text-white dark:text-black" />}
      </button>

      {editing ? (
        <input
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => { if (e.key === 'Enter') onCommit() }}
          autoFocus
          className="flex-1 min-w-0 text-[14px] bg-transparent border-b border-black/30 dark:border-white/30 outline-none text-black dark:text-white"
        />
      ) : (
        <span
          onClick={onToggle}
          className={cn('flex-1 min-w-0 text-[14px] cursor-pointer break-words', item.is_done ? 'line-through text-black/30 dark:text-white/30' : 'text-black/85 dark:text-white/85')}
        >
          {item.text}
        </span>
      )}

      <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <button onClick={onStartEdit} className="p-1 rounded text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white"><Pencil size={12} /></button>
        <button onClick={onRemove} className="p-1 rounded text-black/30 dark:text-white/30 hover:text-red-500"><X size={13} /></button>
      </div>
    </div>
  )
}

// ── List card ─────────────────────────────────────────────────────────────────

function ListCard({ list, active, onClick }: { list: UserList; active: boolean; onClick: () => void }) {
  const p = progress(list)
  const complete = p.total > 0 && p.pending === 0
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer group transition-all duration-200',
        'bg-white dark:bg-white/[0.04] dark:backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]',
        active ? 'border-black/30 dark:border-white/30' : 'border-black/[0.06] dark:border-white/[0.08]',
        complete && 'opacity-60'
      )}
    >
      <div className="w-11 h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[22px] flex-shrink-0">
        {list.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-extrabold truncate text-black/90 dark:text-white/90">{list.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-1 flex-1 max-w-[140px] rounded-full bg-black/[0.07] dark:bg-white/[0.08] overflow-hidden">
            <div className="h-full rounded-full bg-black/60 dark:bg-white/65" style={{ width: `${p.pct}%` }} />
          </div>
          <span className="text-[12px] font-bold text-black/40 dark:text-white/35 tabular-nums">
            {p.total === 0 ? 'Vacía' : `${p.done}/${p.total}`}
          </span>
        </div>
      </div>
      {(!list.is_owner || list.shared_with.length > 0) && (
        <span className="flex items-center gap-1 text-[12px] font-bold text-black/40 dark:text-white/35 flex-shrink-0">
          <Users size={12} /> {list.is_owner ? list.shared_with.length : `de ${list.owner_name ?? 'alguien'}`}
        </span>
      )}
      {p.pending > 0 && (
        <span className="text-[11.5px] px-2 py-1 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] border border-black/10 dark:border-white/10 font-extrabold flex-shrink-0 text-black/60 dark:text-white/60">
          {p.pending} pendiente{p.pending !== 1 ? 's' : ''}
        </span>
      )}
      {complete && <Check size={16} className="text-emerald-500 flex-shrink-0" />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ListasPage() {
  const [me, setMe] = useState<User | null>(null)
  const [lists, setLists] = useState<UserList[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const [panelOpen, setPanelOpen] = useState<boolean>(false)

  useEffect(() => { getMe().then(setMe).catch(() => {}) }, [])

  const load = useCallback(async () => {
    try {
      const data = await getLists()
      setLists(sortByRecent(data))
      return data
    } catch { return [] }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load().then(data => {
      const params = new URLSearchParams(window.location.search)
      const open = params.get('open')
      if (params.get('new') === '1') { setSelectedId(null); setCreating(true); setPanelOpen(true) }
      else if (open && data.some(l => l.id === open)) { setSelectedId(open); setCreating(false); setPanelOpen(true) }
    })
  }, [load])

  const selected = lists.find(l => l.id === selectedId) ?? null

  function replaceList(updated: UserList) {
    setLists(ls => sortByRecent(ls.map(l => l.id === updated.id ? updated : l)))
  }

  function openCreate() { setSelectedId(null); setCreating(true); setPanelOpen(true) }
  function openList(l: UserList) { setSelectedId(l.id); setCreating(false); setPanelOpen(true) }
  function closePanel() { setPanelOpen(false); setSelectedId(null); setCreating(false) }

  async function handleCreate(name: string, emoji: string, shareEmails: string[]) {
    let created = await createList({ name, emoji })
    for (const email of shareEmails) {
      try {
        const res = await shareResource('list', created.id, email)
        created = { ...created, shared_with: res.shared_with }
      } catch { /* the list exists; sharing can be retried from its panel */ }
    }
    setLists(ls => sortByRecent([created, ...ls]))
    setSelectedId(created.id)
    setCreating(false)
  }

  function handleSharedChange(id: string, sharedWith: SharedUser[]) {
    setLists(ls => ls.map(l => l.id === id ? { ...l, shared_with: sharedWith } : l))
  }

  function handleLeft(id: string) {
    setLists(ls => ls.filter(l => l.id !== id))
    closePanel()
  }

  async function handleRename(id: string, data: { name?: string; emoji?: string }) {
    replaceList(await updateList(id, data))
  }

  async function handleDelete(id: string) {
    await deleteList(id)
    setLists(ls => ls.filter(l => l.id !== id))
    closePanel()
  }

  async function handleAddItem(id: string, text: string) {
    replaceList(await addListItem(id, text))
  }

  async function handleToggleItem(id: string, itemId: string, done: boolean) {
    // Optimistic: checking items should feel instant
    setLists(ls => ls.map(l => l.id !== id ? l : { ...l, items: l.items.map(i => i.id === itemId ? { ...i, is_done: done } : i) }))
    try { replaceList(await updateListItem(id, itemId, { is_done: done })) } catch { load() }
  }

  async function handleEditItem(id: string, itemId: string, text: string) {
    replaceList(await updateListItem(id, itemId, { text }))
  }

  async function handleRemoveItem(id: string, itemId: string) {
    replaceList(await deleteListItem(id, itemId))
  }

  async function handleClearDone(id: string) {
    replaceList(await clearCompletedListItems(id))
  }

  const filtered = lists.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
  const totalPending = lists.reduce((s, l) => s + progress(l).pending, 0)
  const dateLabel = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()

  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6 lg:px-8 bg-[radial-gradient(ellipse_80%_50%_at_60%_-10%,rgba(0,0,0,0.03),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_60%_-10%,rgba(255,255,255,0.05),transparent)]">
          {/* Hero */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-950 dark:from-white/[0.14] dark:to-white/[0.04] border border-black/10 dark:border-white/10 p-5 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
              <div>
                <p className="text-[12px] font-bold text-white/60 uppercase tracking-widest mb-1">{dateLabel}</p>
                <h1 className="text-[25px] font-extrabold text-white leading-tight">¡Hola, {me?.full_name?.split(' ')[0] ?? ''}! 🗂️</h1>
                <p className="text-[15px] font-semibold text-white/60 mt-1">
                  {lists.length === 0
                    ? 'Aún no tienes listas'
                    : `${lists.length} lista${lists.length !== 1 ? 's' : ''} · ${totalPending} pendiente${totalPending !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10">
                <ListChecks size={28} className="text-white" />
              </div>
            </div>
            <button
              onClick={openCreate}
              className="w-20 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all flex flex-col items-center justify-center gap-1.5 text-black/50 dark:text-white/60 hover:text-black dark:hover:text-white"
            >
              <Plus size={20} />
              <span className="text-xs">Nueva</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar listas..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-black/40 dark:focus:border-white/40 transition-colors"
            />
          </div>

          {/* Lists */}
          {loading ? (
            <div className="flex items-center justify-center h-40 text-black/30 dark:text-white/30 text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-black/30 dark:text-white/30">
              <ListChecks size={32} strokeWidth={1.5} />
              <p className="text-sm">{search ? 'Sin resultados para tu búsqueda' : 'Sin listas. ¡Crea la primera!'}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(l => (
                <ListCard key={l.id} list={l} active={panelOpen && selectedId === l.id} onClick={() => openList(l)} />
              ))}
            </div>
          )}
        </div>

        {panelOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={closePanel} />
            <div className="fixed inset-x-0 bottom-0 z-50 lg:static lg:z-auto lg:inset-auto">
              <ListPanel
                key={creating ? 'new' : selectedId ?? 'none'}
                list={selected}
                creating={creating}
                onClose={closePanel}
                onCreate={handleCreate}
                meId={me?.id}
                onSharedChange={handleSharedChange}
                onLeft={handleLeft}
                onRename={handleRename}
                onDelete={handleDelete}
                onAddItem={handleAddItem}
                onToggleItem={handleToggleItem}
                onEditItem={handleEditItem}
                onRemoveItem={handleRemoveItem}
                onClearDone={handleClearDone}
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
