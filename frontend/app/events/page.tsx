'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/api'
import type { Task } from '@/lib/types'
import { Search, Plus, X, Trash2, MapPin, Clock, Calendar, AlarmClock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS = ['Trabajo', 'Personal', 'Hogar', 'Finanzas', 'Salud']
const LABEL_COLORS: Record<string, string> = {
  Trabajo: 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30',
  Personal: 'bg-purple-500/20 text-purple-500 dark:text-purple-400 border-purple-500/30',
  Hogar: 'bg-green-500/20 text-green-500 dark:text-green-400 border-green-500/30',
  Finanzas: 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30',
  Salud: 'bg-pink-500/20 text-pink-500 dark:text-pink-400 border-pink-500/30',
}
const LABEL_LEFT_BORDER: Record<string, string> = {
  Trabajo: 'border-l-blue-500',
  Personal: 'border-l-purple-500',
  Hogar: 'border-l-green-500',
  Finanzas: 'border-l-amber-500',
  Salud: 'border-l-pink-500',
}
const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}

function groupEvents(events: Task[]): { label: string; events: Task[] }[] {
  const tod = today()
  const tom = tomorrow()
  const past: Task[] = []
  const todayEvs: Task[] = []
  const tomEvs: Task[] = []
  const upcoming: Task[] = []
  const noDate: Task[] = []

  for (const e of events) {
    if (!e.due_date) { noDate.push(e); continue }
    if (e.due_date < tod) { past.push(e); continue }
    if (e.due_date === tod) { todayEvs.push(e); continue }
    if (e.due_date === tom) { tomEvs.push(e); continue }
    upcoming.push(e)
  }

  const groups: { label: string; events: Task[] }[] = []
  if (past.length) groups.push({ label: 'Pasados', events: past.reverse() })
  if (todayEvs.length) groups.push({ label: 'Hoy', events: todayEvs })
  if (tomEvs.length) groups.push({ label: 'Mañana', events: tomEvs })
  if (upcoming.length) groups.push({ label: 'Próximamente', events: upcoming })
  if (noDate.length) groups.push({ label: 'Sin fecha', events: noDate })
  return groups
}

// ── Event Panel — always dark ─────────────────────────────────────────────────

interface PanelProps {
  event: Task | null
  creating: boolean
  onClose: () => void
  onSave: (data: Parameters<typeof createTask>[0]) => Promise<void>
  onUpdate: (id: string, data: Parameters<typeof updateTask>[1]) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function EventPanel({ event, creating, onClose, onSave, onUpdate, onDelete }: PanelProps) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [label, setLabel] = useState<string | null>(event?.label ?? null)
  const [dueDate, setDueDate] = useState(event?.due_date ?? '')
  const [dueTime, setDueTime] = useState(event?.due_time?.slice(0, 5) ?? '')
  const [allDay, setAllDay] = useState(!event?.due_time)
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const panelLabel = 'text-[11px] font-extrabold text-black/30 dark:text-white/30 uppercase tracking-widest mb-2'
  const panelInput = 'w-full text-[13px] bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/20 outline-none focus:border-[#6B46E5]/40 transition-colors'

  function buildPayload() {
    return {
      title: title.trim(),
      notes: notes.trim() || null,
      label,
      is_event: true,
      due_date: dueDate || null,
      due_time: allDay ? null : (dueTime || null),
      location: location.trim() || null,
      reminder_at: null,
      remind_day_before: false,
    }
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (creating) await onSave(buildPayload())
      else if (event) await onUpdate(event.id, buildPayload())
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#141414] border-l border-black/[0.06] dark:border-white/[0.08] w-80 min-w-[300px]" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <span className="text-[14px] font-bold text-black/80 dark:text-white/80">{creating ? 'Nuevo evento' : 'Editar evento'}</span>
        <div className="flex gap-1">
          {!creating && event && (
            <button onClick={() => onDelete(event.id)} className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nombre del evento"
          autoFocus={creating}
          className="w-full bg-transparent text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 text-[19px] font-bold outline-none border-b border-black/10 dark:border-white/10 pb-2 focus:border-[#6B46E5]/60 transition-colors"
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />

        {/* Label */}
        <div>
          <p className={panelLabel}>Etiqueta</p>
          <div className="flex flex-wrap gap-1.5">
            {LABELS.map(l => (
              <button
                key={l}
                onClick={() => setLabel(label === l ? null : l)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-all',
                  label === l ? LABEL_COLORS[l] : 'border-black/10 dark:border-white/10 text-black/40 dark:text-white/40 hover:border-black/20 dark:hover:border-white/20 hover:text-black/60 dark:hover:text-white/60'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <p className={panelLabel}>Fecha</p>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={panelInput} />
        </div>

        {/* Time */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={panelLabel + ' mb-0'}>Hora</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setAllDay(v => !v)}
                className={cn('w-8 h-4 rounded-full transition-colors relative cursor-pointer', allDay ? 'bg-[#6B46E5]' : 'bg-black/10 dark:bg-white/10')}
              >
                <div className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', allDay ? 'left-4' : 'left-0.5')} />
              </div>
              <span className="text-xs text-black/50 dark:text-white/50">Todo el día</span>
            </label>
          </div>
          {!allDay && (
            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className={panelInput} />
          )}
        </div>

        {/* Location */}
        <div>
          <p className={panelLabel}>Ubicación</p>
          <div className="relative">
            <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Agregar ubicación..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/20 outline-none focus:border-[#6B46E5]/40 transition-colors"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className={panelLabel}>Notas</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Agregar nota..."
            rows={3}
            className={cn(panelInput, 'resize-none')}
          />
        </div>

        {/* Auto-reminder info */}
        <div className="rounded-xl bg-[#6B46E5]/10 border border-[#6B46E5]/20 p-3">
          <div className="flex items-start gap-2">
            <AlarmClock size={14} className="text-[#AF9BFF] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[#AF9BFF]/80 leading-relaxed">
              FRIDAY te avisará automáticamente 3 días, 1 día y 1 hora antes del evento.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full py-2.5 rounded-xl bg-[#6B46E5] hover:bg-[#5a38c8] disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {saving ? 'Guardando...' : creating ? 'Crear evento' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: Task; onClick: () => void }) {
  const d = event.due_date ? new Date(event.due_date + 'T12:00:00') : null
  const day = d?.getDate()
  const month = d ? MONTHS_ES[d.getMonth()] : null
  const isPast = event.due_date ? event.due_date < today() : false
  const leftBorder = event.label ? LABEL_LEFT_BORDER[event.label] : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 px-4 py-3.5 rounded-xl border border-l-4 cursor-pointer group transition-all overflow-hidden',
        leftBorder ?? 'border-l-transparent',
        isPast
          ? 'bg-black/[0.01] dark:bg-white/[0.01] border-black/[0.05] dark:border-white/[0.05] opacity-50'
          : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.07] dark:border-white/[0.07] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/10 dark:hover:border-white/10'
      )}
    >
      {/* Date badge */}
      {d ? (
        <div className={cn(
          'flex flex-col items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
          isPast ? 'bg-black/[0.04] dark:bg-white/[0.04]' : 'bg-[#6B46E5]/20 border border-[#6B46E5]/30'
        )}>
          <span className={cn('text-[22px] font-extrabold leading-none', isPast ? 'text-black/30 dark:text-white/30' : 'text-[#6B46E5] dark:text-[#AF9BFF]')}>{day}</span>
          <span className={cn('text-[10px] font-extrabold uppercase leading-none mt-0.5', isPast ? 'text-black/20 dark:text-white/20' : 'text-[#6B46E5]/70 dark:text-[#AF9BFF]/70')}>{month}</span>
        </div>
      ) : (
        <div className="w-11 h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center flex-shrink-0">
          <Calendar size={16} className="text-black/20 dark:text-white/20" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-[16px] font-extrabold truncate', isPast ? 'text-black/40 dark:text-white/40' : 'text-black/90 dark:text-white/90')}>
          {event.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {event.due_time && (
            <span className="flex items-center gap-1 text-[12px] font-bold text-black/40 dark:text-white/35">
              <Clock size={11} /> {event.due_time.slice(0, 5)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 text-[12px] font-bold text-black/40 dark:text-white/35 truncate max-w-[140px]">
              <MapPin size={11} /> {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Label chip — right side */}
      {event.label && (
        <span className={cn('text-[11.5px] px-2 py-1 rounded-lg border font-extrabold flex-shrink-0', LABEL_COLORS[event.label] ?? 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black/40 dark:text-white/40')}>
          {event.label}
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [events, setEvents] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const [panelEvent, setPanelEvent] = useState<Task | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getTasks({ is_event: true, label: filterLabel ?? undefined, search: search || undefined })
      setEvents(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filterLabel, search])

  useEffect(() => { load() }, [load])

  function openCreate() { setPanelEvent(null); setCreating(true); setPanelOpen(true) }
  function openEdit(e: Task) { setPanelEvent(e); setCreating(false); setPanelOpen(true) }
  function closePanel() { setPanelOpen(false); setPanelEvent(null) }

  async function handleSave(data: Parameters<typeof createTask>[0]) {
    await createTask(data); await load(); closePanel()
  }

  async function handleUpdate(id: string, data: Parameters<typeof updateTask>[1]) {
    const updated = await updateTask(id, data)
    setEvents(es => es.map(e => e.id === id ? updated : e))
    setPanelEvent(updated)
  }

  async function handleDelete(id: string) {
    await deleteTask(id); await load(); closePanel()
  }

  const upcoming = events.filter(e => !e.due_date || e.due_date >= today())
  const dateLabel = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
  const groups = groupEvents(events)

  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6 lg:px-8">
          {/* Hero */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 rounded-2xl bg-gradient-to-br from-[#6B46E5] to-[#4a2fa0] p-5 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold text-purple-200/80 uppercase tracking-widest mb-1">{dateLabel}</p>
                <h1 className="text-[25px] font-extrabold text-white leading-tight">¡Vamos, Sebastián! 👍</h1>
                <p className="text-[15px] font-semibold text-purple-200/80 mt-1">
                  {upcoming.length === 0
                    ? 'Sin eventos próximos'
                    : `${upcoming.length} evento${upcoming.length !== 1 ? 's' : ''} próximo${upcoming.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10">
                <CalendarDays size={28} className="text-white" />
              </div>
            </div>
            <button
              onClick={openCreate}
              className="w-20 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all flex flex-col items-center justify-center gap-1.5 text-black/50 dark:text-white/60 hover:text-black dark:hover:text-white"
            >
              <Plus size={20} />
              <span className="text-xs">Nuevo</span>
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar eventos..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 outline-none focus:border-[#6B46E5]/40 transition-colors"
              />
            </div>
          </div>

          {/* Label filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {['Todas', ...LABELS].map(l => (
              <button
                key={l}
                onClick={() => setFilterLabel(l === 'Todas' ? null : l)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
                  (l === 'Todas' && !filterLabel) || filterLabel === l
                    ? 'bg-[#6B46E5] text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/[0.07] dark:hover:bg-white/[0.07]'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Events list */}
          {loading ? (
            <div className="flex items-center justify-center h-40 text-black/30 dark:text-white/30 text-sm">Cargando...</div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-black/30 dark:text-white/30">
              <CalendarDays size={32} strokeWidth={1.5} />
              <p className="text-sm">Sin eventos. ¡Crea uno!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(({ label, events: ge }) => (
                <div key={label}>
                  <p className="text-[13px] font-extrabold text-black/30 dark:text-white/30 uppercase tracking-widest mb-2">{label}</p>
                  <div className="space-y-1.5">
                    {ge.map(e => (
                      <EventCard key={e.id} event={e} onClick={() => openEdit(e)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel — always dark */}
        {panelOpen && (
          <EventPanel
            event={panelEvent}
            creating={creating}
            onClose={closePanel}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>
    </AppLayout>
  )
}
