'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getNotes, createNote, updateNote, deleteNote, toggleNotePin } from '@/lib/api'
import { Note } from '@/lib/types'
import { Pin, Trash2, Plus, Search, X } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LABELS = ['Todas', 'Trabajo', 'Personal', 'Hogar', 'Finanzas', 'Ideas']

const COLOR_OPTIONS = [
  { key: 'rojo',     dot: '#EF4444' },
  { key: 'verde',    dot: '#14B8A6' },
  { key: 'amarillo', dot: '#EAB308' },
  { key: 'morado',   dot: '#A855F7' },
  { key: 'azul',     dot: '#3B82F6' },
  { key: 'rosa',     dot: '#EC4899' },
]

const CARD_BG_DARK: Record<string, { bg: string; border: string }> = {
  default:   { bg: 'rgba(255,255,255,0.04)',  border: 'rgba(255,255,255,0.09)' },
  rojo:      { bg: 'rgba(120,15,15,0.55)',    border: 'rgba(220,60,60,0.25)' },
  verde:     { bg: 'rgba(10,65,58,0.55)',     border: 'rgba(20,155,135,0.25)' },
  amarillo:  { bg: 'rgba(85,72,0,0.55)',      border: 'rgba(185,158,0,0.25)' },
  morado:    { bg: 'rgba(62,22,110,0.55)',    border: 'rgba(135,65,215,0.25)' },
  azul:      { bg: 'rgba(14,36,92,0.55)',     border: 'rgba(45,95,215,0.25)' },
  rosa:      { bg: 'rgba(102,16,66,0.55)',    border: 'rgba(215,48,135,0.25)' },
}

const CARD_BG_LIGHT: Record<string, { bg: string; border: string }> = {
  default:   { bg: '#F9FAFB', border: '#E5E7EB' },
  rojo:      { bg: '#FEE2E2', border: '#FECACA' },
  verde:     { bg: '#CCFBF1', border: '#99F6E4' },
  amarillo:  { bg: '#FEF9C3', border: '#FDE68A' },
  morado:    { bg: '#F3E8FF', border: '#E9D5FF' },
  azul:      { bg: '#DBEAFE', border: '#BFDBFE' },
  rosa:      { bg: '#FCE7F3', border: '#FBCFE8' },
}

const LABEL_STYLE_DARK: Record<string, { bg: string; color: string }> = {
  Trabajo:  { bg: 'rgba(13,148,136,0.25)',  color: '#2DD4BF' },
  Personal: { bg: 'rgba(124,58,237,0.25)',  color: '#C084FC' },
  Hogar:    { bg: 'rgba(5,150,105,0.25)',   color: '#4ADE80' },
  Finanzas: { bg: 'rgba(217,119,6,0.25)',   color: '#FBBF24' },
  Ideas:    { bg: 'rgba(225,29,72,0.25)',   color: '#FB7185' },
}

const LABEL_STYLE_LIGHT: Record<string, { bg: string; color: string }> = {
  Trabajo:  { bg: '#CCFBF1', color: '#0D9488' },
  Personal: { bg: '#F3E8FF', color: '#7C3AED' },
  Hogar:    { bg: '#DCFCE7', color: '#16A34A' },
  Finanzas: { bg: '#FEF9C3', color: '#B45309' },
  Ideas:    { bg: '#FFE4E6', color: '#E11D48' },
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIsDark() {
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note
  isDark: boolean
  onPin: () => void
  onDelete: () => void
  onEdit: (note: Note) => void
}

function NoteCard({ note, isDark, onPin, onDelete, onEdit }: NoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const palette = isDark ? CARD_BG_DARK : CARD_BG_LIGHT
  const { bg, border } = palette[note.color] ?? palette.default
  const labelStyle = isDark
    ? (LABEL_STYLE_DARK[note.label ?? ''] ?? { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' })
    : (LABEL_STYLE_LIGHT[note.label ?? ''] ?? { bg: '#F3F4F6', color: '#374151' })

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 2500)
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-lg"
      style={{ background: bg, border: `1px solid ${border}` }}
      onClick={() => onEdit(note)}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-bold text-base leading-snug flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {note.title}
        </h3>
        <button
          onClick={e => { e.stopPropagation(); onPin() }}
          className="flex-shrink-0 mt-0.5 transition-all duration-200 hover:scale-110"
          title={note.is_pinned ? 'Desfijar' : 'Fijar'}
        >
          <Pin
            size={16}
            className={note.is_pinned
              ? 'fill-current'
              : 'opacity-30 hover:opacity-70'}
            style={{ color: note.is_pinned ? '#FF6B9D' : (isDark ? '#fff' : '#374151') }}
          />
        </button>
      </div>

      {/* Content preview */}
      {note.content && (
        <p className={`text-sm leading-relaxed line-clamp-2 ${isDark ? 'text-white/65' : 'text-gray-600'}`}>
          {note.content}
        </p>
      )}

      {/* Footer: label + trash */}
      <div className="flex items-center justify-between mt-1" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {note.label && (
            <span
              className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: labelStyle.bg, color: labelStyle.color }}
            >
              {note.label}
            </span>
          )}
        </div>
        <button
          onClick={handleDelete}
          className={`transition-all duration-200 hover:scale-110 ${
            confirmDelete
              ? 'text-red-500'
              : isDark ? 'text-white/30 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
          }`}
          title={confirmDelete ? 'Clic para confirmar' : 'Eliminar'}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── CreateEditForm ───────────────────────────────────────────────────────────

interface FormState {
  title: string
  content: string
  label: string
  color: string
  is_pinned: boolean
}

const EMPTY_FORM: FormState = { title: '', content: '', label: '', color: 'default', is_pinned: false }

interface NoteFormProps {
  isDark: boolean
  initial?: FormState
  onSave: (data: FormState) => void
  onCancel: () => void
}

function NoteForm({ isDark, initial, onSave, onCancel }: NoteFormProps) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)

  const cardBg = isDark
    ? 'rgba(255,255,255,0.04)'
    : '#FFFFFF'
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'

  return (
    <div
      className="rounded-2xl p-5 mb-6"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <input
        autoFocus
        placeholder="Título"
        value={form.title}
        onChange={e => setForm({ ...form, title: e.target.value })}
        className={`w-full bg-transparent font-semibold text-lg outline-none placeholder-current mb-2 ${
          isDark ? 'text-white placeholder-white/30' : 'text-gray-900 placeholder-gray-400'
        }`}
      />
      <textarea
        placeholder="Escribe algo..."
        value={form.content}
        onChange={e => setForm({ ...form, content: e.target.value })}
        rows={3}
        className={`w-full bg-transparent text-sm outline-none resize-none placeholder-current mb-4 ${
          isDark ? 'text-white/80 placeholder-white/30' : 'text-gray-700 placeholder-gray-400'
        }`}
      />

      {/* Label selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {LABELS.slice(1).map(l => {
          const lsDark = LABEL_STYLE_DARK[l] ?? { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }
          const lsLight = LABEL_STYLE_LIGHT[l] ?? { bg: '#F3F4F6', color: '#374151' }
          const ls = isDark ? lsDark : lsLight
          const active = form.label === l
          return (
            <button
              key={l}
              onClick={() => setForm({ ...form, label: form.label === l ? '' : l })}
              className="text-xs font-medium px-3 py-1 rounded-full transition-all duration-150"
              style={active
                ? { background: ls.bg, color: ls.color, border: `1.5px solid ${ls.color}` }
                : {
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                    color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280',
                    border: '1.5px solid transparent',
                  }
              }
            >
              {l}
            </button>
          )
        })}
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setForm({ ...form, color: 'default' })}
          className="w-6 h-6 rounded-full border-2 transition-all duration-150"
          style={{
            background: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
            borderColor: form.color === 'default'
              ? (isDark ? '#fff' : '#374151')
              : 'transparent',
          }}
          title="Sin color"
        />
        {COLOR_OPTIONS.map(c => (
          <button
            key={c.key}
            onClick={() => setForm({ ...form, color: c.key })}
            className="w-6 h-6 rounded-full border-2 transition-all duration-150 hover:scale-110"
            style={{
              background: c.dot,
              borderColor: form.color === c.key ? (isDark ? '#fff' : '#374151') : 'transparent',
            }}
            title={c.key}
          />
        ))}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setForm({ ...form, is_pinned: !form.is_pinned })}
          className={`flex items-center gap-1.5 text-sm transition-all duration-150 ${
            form.is_pinned
              ? 'text-pink-400'
              : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Pin size={14} className={form.is_pinned ? 'fill-current' : ''} />
          Fijar
        </button>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`text-sm px-4 py-1.5 rounded-xl transition-all duration-150 ${
              isDark
                ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={() => { if (form.title.trim()) onSave(form) }}
            disabled={!form.title.trim()}
            className="text-sm px-5 py-1.5 rounded-xl font-semibold text-white transition-all duration-150 disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotasPage() {
  const isDark = useIsDark()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLabel, setActiveLabel] = useState('Todas')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getNotes()
      setNotes(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form: FormState) {
    const note = await createNote({
      title: form.title,
      content: form.content || null,
      label: form.label || null,
      color: form.color,
      is_pinned: form.is_pinned,
    })
    setNotes(prev => [note, ...prev].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)))
    setShowForm(false)
  }

  async function handleEdit(form: FormState) {
    if (!editingNote) return
    const updated = await updateNote(editingNote.id, {
      title: form.title,
      content: form.content || null,
      label: form.label || null,
      color: form.color,
      is_pinned: form.is_pinned,
    })
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    setEditingNote(null)
  }

  async function handleDelete(id: string) {
    await deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function handlePin(id: string) {
    const updated = await toggleNotePin(id)
    setNotes(prev =>
      prev
        .map(n => n.id === updated.id ? updated : n)
        .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    )
  }

  const filtered = useMemo(() => {
    return notes.filter(n => {
      const matchesLabel = activeLabel === 'Todas' || n.label === activeLabel
      const q = search.toLowerCase()
      const matchesSearch = !q || n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q)
      return matchesLabel && matchesSearch
    })
  }, [notes, activeLabel, search])

  const pinned = filtered.filter(n => n.is_pinned)
  const others = filtered.filter(n => !n.is_pinned)

  const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto pb-24">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold" style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Notas
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
              {notes.length} {notes.length === 1 ? 'nota activa' : 'notas activas'}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0 w-48 sm:w-64">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/35' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-8 pr-8 py-2 rounded-full text-sm outline-none transition-all ${
                isDark
                  ? 'bg-white/[0.07] border border-white/[0.08] text-white placeholder-white/35 focus:border-white/20'
                  : 'bg-black/[0.04] border border-black/[0.08] text-gray-900 placeholder-gray-400 focus:border-black/20'
              }`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'}`}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Label filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {LABELS.map(l => (
            <button
              key={l}
              onClick={() => setActiveLabel(l)}
              className="text-sm px-4 py-1.5 rounded-full font-medium transition-all duration-150"
              style={activeLabel === l
                ? { background: '#6B46E5', color: '#fff' }
                : {
                    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? 'rgba(255,255,255,0.6)' : '#374151',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)',
                  }
              }
            >
              {l}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <NoteForm
            isDark={isDark}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Edit form (modal-like inline replacement) */}
        {editingNote && (
          <NoteForm
            isDark={isDark}
            initial={{
              title: editingNote.title,
              content: editingNote.content ?? '',
              label: editingNote.label ?? '',
              color: editingNote.color,
              is_pinned: editingNote.is_pinned,
            }}
            onSave={handleEdit}
            onCancel={() => setEditingNote(null)}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className={`h-6 w-6 animate-spin rounded-full border-2 ${isDark ? 'border-white/20 border-t-white' : 'border-black/20 border-t-black'}`} />
          </div>
        ) : (
          <>
            {/* Fijadas */}
            {pinned.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Pin size={11} style={{ color: '#FF6B9D' }} className="fill-current" />
                  <span style={sectionLabelStyle}>FIJADAS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pinned.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isDark={isDark}
                      onPin={() => handlePin(note.id)}
                      onDelete={() => handleDelete(note.id)}
                      onEdit={n => { setEditingNote(n); setShowForm(false) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Otras */}
            {others.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={sectionLabelStyle}>OTRAS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {others.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isDark={isDark}
                      onPin={() => handlePin(note.id)}
                      onDelete={() => handleDelete(note.id)}
                      onEdit={n => { setEditingNote(n); setShowForm(false) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && !showForm && (
              <div className={`text-center py-20 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                <p className="text-lg font-medium mb-1">Sin notas</p>
                <p className="text-sm">Toca + para crear una</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {!showForm && !editingNote && (
        <button
          onClick={() => { setShowForm(true); setEditingNote(null) }}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 z-30"
          style={{ background: 'linear-gradient(135deg, #FF6B9D, #6B46E5)' }}
        >
          <Plus size={24} />
        </button>
      )}
    </AppLayout>
  )
}
