'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import {
  getTasks, createTask, updateTask, deleteTask, toggleTaskComplete,
  createSubtask, updateSubtask, deleteSubtask,
} from '@/lib/api'
import type { Task, Subtask } from '@/lib/types'
import {
  Search, Star, Plus, X, Trash2, Check, RotateCcw,
  AlarmClock, Calendar, CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS = ['Trabajo', 'Personal', 'Hogar', 'Finanzas', 'Salud']
const LABEL_COLORS: Record<string, string> = {
  Trabajo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Personal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Hogar: 'bg-green-500/20 text-green-400 border-green-500/30',
  Finanzas: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Salud: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
}
const RECURRENCE_OPTIONS = ['No se repite', 'Diario', 'Semanal', 'Mensual']
const RECURRENCE_MAP: Record<string, string | null> = {
  'No se repite': null, 'Diario': 'daily', 'Semanal': 'weekly', 'Mensual': 'monthly',
}
const RECURRENCE_LABEL: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual',
}

function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}

function groupTasks(tasks: Task[]): { label: string; tasks: Task[] }[] {
  const tod = today()
  const tom = tomorrow()
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)

  const groups: Record<string, Task[]> = { Hoy: [], Mañana: [], 'Esta semana': [], 'Sin fecha': [] }
  for (const t of tasks) {
    if (!t.due_date) { groups['Sin fecha'].push(t); continue }
    if (t.due_date === tod) { groups['Hoy'].push(t); continue }
    if (t.due_date === tom) { groups['Mañana'].push(t); continue }
    const d = new Date(t.due_date)
    if (d <= weekEnd) { groups['Esta semana'].push(t) } else {
      const label = d.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' })
      if (!groups[label]) groups[label] = []
      groups[label].push(t)
    }
  }
  return Object.entries(groups)
    .filter(([, ts]) => ts.length > 0)
    .map(([label, tasks]) => ({ label, tasks }))
}

function progressRing(tasks: Task[]) {
  const total = tasks.length
  const done = tasks.filter(t => t.is_completed).length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const r = 28; const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return { pct, offset, circ, r }
}

// ── Task Panel (right drawer) ─────────────────────────────────────────────────

interface PanelProps {
  task: Task | null
  onClose: () => void
  onSave: (data: Parameters<typeof createTask>[0]) => Promise<void>
  onUpdate: (id: string, data: Parameters<typeof updateTask>[1]) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddSubtask: (taskId: string, title: string) => Promise<void>
  onToggleSubtask: (taskId: string, subId: string, done: boolean) => Promise<void>
  onDeleteSubtask: (taskId: string, subId: string) => Promise<void>
  creating: boolean
}

function TaskPanel({ task, onClose, onSave, onUpdate, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask, creating }: PanelProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [label, setLabel] = useState<string | null>(task?.label ?? null)
  const [dueDateType, setDueDateType] = useState<'hoy' | 'manana' | 'custom' | 'none'>(
    !task?.due_date ? 'none' : task.due_date === today() ? 'hoy' : task.due_date === tomorrow() ? 'manana' : 'custom'
  )
  const [customDate, setCustomDate] = useState(task?.due_date ?? '')
  const [reminderTime, setReminderTime] = useState(task?.reminder_at ? task.reminder_at.slice(11, 16) : '')
  const [reminderDate, setReminderDate] = useState(task?.reminder_at ? task.reminder_at.slice(0, 10) : '')
  const [dayBefore, setDayBefore] = useState(task?.remind_day_before ?? false)
  const [recurrence, setRecurrence] = useState(
    task?.recurrence ? (RECURRENCE_LABEL[task.recurrence] ?? 'No se repite') : 'No se repite'
  )
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [newSubtask, setNewSubtask] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (creating) titleRef.current?.focus() }, [creating])

  function buildPayload() {
    let due_date: string | null = null
    if (dueDateType === 'hoy') due_date = today()
    else if (dueDateType === 'manana') due_date = tomorrow()
    else if (dueDateType === 'custom') due_date = customDate || null

    let reminder_at: string | null = null
    if (reminderTime) {
      const base = reminderDate || due_date || today()
      reminder_at = `${base}T${reminderTime}:00`
    }

    return {
      title: title.trim(),
      notes: notes.trim() || null,
      label,
      is_event: false,
      due_date,
      reminder_at,
      remind_day_before: dayBefore,
      recurrence: RECURRENCE_MAP[recurrence] ?? null,
    }
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (creating) await onSave(buildPayload())
      else if (task) await onUpdate(task.id, buildPayload())
    } finally { setSaving(false) }
  }

  async function handleAddSubtask(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !newSubtask.trim() || !task) return
    await onAddSubtask(task.id, newSubtask.trim())
    setNewSubtask('')
  }

  return (
    <div className="flex flex-col h-full bg-[#111] border-l border-white/10 w-80 min-w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white/80">{creating ? 'Nueva tarea' : 'Editar tarea'}</span>
        <div className="flex gap-1">
          {!creating && task && (
            <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nombre de la tarea"
          className="w-full bg-transparent text-white placeholder-white/30 text-base font-medium outline-none border-b border-white/10 pb-2 focus:border-[#6B46E5]/60 transition-colors"
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />

        {/* Label */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Etiqueta</p>
          <div className="flex flex-wrap gap-1.5">
            {LABELS.map(l => (
              <button
                key={l}
                onClick={() => setLabel(label === l ? null : l)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-all',
                  label === l ? LABEL_COLORS[l] : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Fecha</p>
          <div className="flex gap-1.5 mb-2">
            {(['hoy', 'manana', 'none'] as const).map(t => (
              <button
                key={t}
                onClick={() => setDueDateType(t)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg border transition-all',
                  dueDateType === t
                    ? 'bg-[#6B46E5]/20 border-[#6B46E5]/40 text-[#AF9BFF]'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                )}
              >
                {t === 'hoy' ? 'Hoy' : t === 'manana' ? 'Mañana' : 'Sin fecha'}
              </button>
            ))}
            <button
              onClick={() => setDueDateType('custom')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-all',
                dueDateType === 'custom'
                  ? 'bg-[#6B46E5]/20 border-[#6B46E5]/40 text-[#AF9BFF]'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              )}
            >
              <Calendar size={12} />
            </button>
          </div>
          {dueDateType === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 outline-none focus:border-[#6B46E5]/40"
            />
          )}
        </div>

        {/* Reminder */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Recordatorio</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <AlarmClock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="date"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                className="w-full text-xs bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white/80 outline-none focus:border-[#6B46E5]/40"
              />
            </div>
            <input
              type="time"
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              className="w-24 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 outline-none focus:border-[#6B46E5]/40"
            />
          </div>
          {reminderTime && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <div
                onClick={() => setDayBefore(b => !b)}
                className={cn(
                  'w-8 h-4 rounded-full transition-colors relative',
                  dayBefore ? 'bg-[#6B46E5]' : 'bg-white/10'
                )}
              >
                <div className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', dayBefore ? 'left-4' : 'left-0.5')} />
              </div>
              <span className="text-xs text-white/50">Avisar un día antes</span>
            </label>
          )}
        </div>

        {/* Recurrence */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Repetir</p>
          <select
            value={recurrence}
            onChange={e => setRecurrence(e.target.value)}
            className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 outline-none focus:border-[#6B46E5]/40"
          >
            {RECURRENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Notas</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Agregar nota..."
            rows={3}
            className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 placeholder-white/20 outline-none focus:border-[#6B46E5]/40 resize-none"
          />
        </div>

        {/* Subtasks */}
        {!creating && task && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">
              Subtareas {task.subtasks.length > 0 && `${task.subtasks.filter(s => s.is_completed).length}/${task.subtasks.length}`}
            </p>
            <div className="space-y-1 mb-2">
              {task.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => onToggleSubtask(task.id, sub.id, !sub.is_completed)}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                      sub.is_completed ? 'bg-[#6B46E5] border-[#6B46E5]' : 'border-white/20 hover:border-[#6B46E5]/60'
                    )}
                  >
                    {sub.is_completed && <Check size={10} className="text-white" />}
                  </button>
                  <span className={cn('text-xs flex-1', sub.is_completed ? 'line-through text-white/30' : 'text-white/70')}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(task.id, sub.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-red-400 transition-all"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={handleAddSubtask}
              placeholder="Agregar una tarea..."
              className="w-full text-xs bg-transparent text-white/60 placeholder-white/20 outline-none border-b border-white/10 pb-1 focus:border-[#6B46E5]/40"
            />
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full py-2.5 rounded-xl bg-[#6B46E5] hover:bg-[#5a38c8] disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {saving ? 'Guardando...' : creating ? 'Crear tarea' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onStar, onClick }: { task: Task; onToggle: () => void; onStar: () => void; onClick: () => void }) {
  const subtasksDone = task.subtasks.filter(s => s.is_completed).length
  const subtasksTotal = task.subtasks.length
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer group transition-all',
        task.is_completed
          ? 'bg-white/[0.01] border-white/5 opacity-60'
          : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05] hover:border-white/10'
      )}
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          task.is_completed ? 'bg-[#6B46E5] border-[#6B46E5]' : 'border-white/25 hover:border-[#6B46E5]/70'
        )}
      >
        {task.is_completed && <Check size={11} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', task.is_completed ? 'line-through text-white/40' : 'text-white/90')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.label && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', LABEL_COLORS[task.label] ?? 'bg-white/5 border-white/10 text-white/40')}>
              {task.label}
            </span>
          )}
          {task.due_time && (
            <span className="flex items-center gap-1 text-[10px] text-white/35">
              <AlarmClock size={10} /> {task.due_time.slice(0, 5)}
            </span>
          )}
          {subtasksTotal > 0 && (
            <span className="text-[10px] text-white/35">{subtasksDone}/{subtasksTotal}</span>
          )}
          {task.recurrence && (
            <RotateCcw size={10} className="text-white/25" />
          )}
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onStar() }}
        className={cn('flex-shrink-0 transition-colors', task.is_starred ? 'text-amber-400' : 'text-white/20 hover:text-amber-400/60 opacity-0 group-hover:opacity-100')}
      >
        <Star size={14} fill={task.is_starred ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ToDoPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'estrella'>('fecha')
  const [panelTask, setPanelTask] = useState<Task | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getTasks({ is_event: false, label: filterLabel ?? undefined, search: search || undefined })
      setTasks(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filterLabel, search])

  useEffect(() => { load() }, [load])

  const todayTasks = tasks.filter(t => t.due_date === today())
  const { pct, offset, circ, r } = progressRing(todayTasks)

  function openCreate() { setPanelTask(null); setCreating(true); setPanelOpen(true) }
  function openEdit(t: Task) { setPanelTask(t); setCreating(false); setPanelOpen(true) }
  function closePanel() { setPanelOpen(false); setPanelTask(null) }

  async function handleSave(data: Parameters<typeof createTask>[0]) {
    await createTask(data); await load(); closePanel()
  }

  async function handleUpdate(id: string, data: Parameters<typeof updateTask>[1]) {
    const updated = await updateTask(id, data)
    setTasks(ts => ts.map(t => t.id === id ? updated : t))
    setPanelTask(updated)
  }

  async function handleDelete(id: string) {
    await deleteTask(id); await load(); closePanel()
  }

  async function handleToggle(id: string) {
    const updated = await toggleTaskComplete(id)
    setTasks(ts => ts.map(t => t.id === id ? updated : t))
    if (panelTask?.id === id) setPanelTask(updated)
  }

  async function handleStar(id: string, current: boolean) {
    const updated = await updateTask(id, { is_starred: !current })
    setTasks(ts => ts.map(t => t.id === id ? updated : t))
  }

  async function handleAddSubtask(taskId: string, title: string) {
    const sub = await createSubtask(taskId, title)
    const refreshed = await getTasks({ is_event: false })
    setTasks(refreshed)
    const updated = refreshed.find(t => t.id === taskId) ?? panelTask
    if (updated) setPanelTask({ ...updated })
  }

  async function handleToggleSubtask(taskId: string, subId: string, done: boolean) {
    await updateSubtask(taskId, subId, { is_completed: done })
    const refreshed = await getTasks({ is_event: false })
    setTasks(refreshed)
    const updated = refreshed.find(t => t.id === taskId)
    if (updated) setPanelTask({ ...updated })
  }

  async function handleDeleteSubtask(taskId: string, subId: string) {
    await deleteSubtask(taskId, subId)
    const refreshed = await getTasks({ is_event: false })
    setTasks(refreshed)
    const updated = refreshed.find(t => t.id === taskId)
    if (updated) setPanelTask({ ...updated })
  }

  const sorted = [...tasks].sort((a, b) => {
    if (sortBy === 'nombre') return a.title.localeCompare(b.title)
    if (sortBy === 'estrella') return Number(b.is_starred) - Number(a.is_starred)
    // fecha: null last
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const pending = todayTasks.filter(t => !t.is_completed).length
  const dateLabel = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()

  const groups = groupTasks(sorted)

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6 lg:px-8">
          {/* Hero */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 rounded-2xl bg-gradient-to-br from-[#6B46E5] to-[#4a2fa0] p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-200/80 font-medium uppercase tracking-widest mb-1">{dateLabel}</p>
                <h1 className="text-2xl font-bold text-white">¡Vamos, Sebastián! 👍</h1>
                <p className="text-sm text-purple-200/80 mt-1">
                  {pending === 0 ? 'Todas las tareas de hoy completadas 🎉' : `Te quedan ${pending} tareas para hoy`}
                </p>
              </div>
              <div className="relative flex-shrink-0">
                <svg width={72} height={72} className="-rotate-90">
                  <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} />
                  <circle cx={36} cy={36} r={r} fill="none" stroke="white" strokeWidth={5}
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">{pct}%</span>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="w-20 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all flex flex-col items-center justify-center gap-1.5 text-white/60 hover:text-white"
            >
              <Plus size={20} />
              <span className="text-xs">Nueva</span>
            </button>
          </div>

          {/* Search + sort */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-[#6B46E5]/40 transition-colors"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/70 outline-none focus:border-[#6B46E5]/40 cursor-pointer"
            >
              <option value="fecha">Por fecha</option>
              <option value="nombre">Por nombre</option>
              <option value="estrella">Destacadas</option>
            </select>
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
                    : 'bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.07]'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Task list */}
          {loading ? (
            <div className="flex items-center justify-center h-40 text-white/30 text-sm">Cargando...</div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/30">
              <CheckSquare size={32} strokeWidth={1.5} />
              <p className="text-sm">Sin tareas. ¡Crea una!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(({ label, tasks: groupTasks }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">{label}</p>
                  <div className="space-y-1.5">
                    {groupTasks.map(t => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={() => handleToggle(t.id)}
                        onStar={() => handleStar(t.id, t.is_starred)}
                        onClick={() => openEdit(t)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        {panelOpen && (
          <TaskPanel
            task={panelTask}
            onClose={closePanel}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            creating={creating}
          />
        )}
      </div>
    </AppLayout>
  )
}
