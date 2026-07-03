'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getHabits, createHabit, deleteHabit, toggleHabitLog } from '@/lib/api'
import type { Habit } from '@/lib/types'
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAYS_ES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`
}

function todayISO(): string {
  return toISO(new Date())
}

export default function HabitosPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()))
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartISO = toISO(weekStart)
  const weekEndISO = toISO(weekDates[6])
  const today = todayISO()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHabits(weekStartISO)
      setHabits(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [weekStartISO])

  useEffect(() => { load() }, [load])

  function prevWeek() {
    setWeekStart(w => addDays(w, -7))
  }

  function nextWeek() {
    setWeekStart(w => addDays(w, 7))
  }

  async function handleToggle(habitId: string, dateISO: string) {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h
      const done = h.completed_dates.includes(dateISO)
      const completed_dates = done
        ? h.completed_dates.filter(d => d !== dateISO)
        : [...h.completed_dates, dateISO]
      const weekCount = weekDates.filter(d => completed_dates.includes(toISO(d))).length
      return { ...h, completed_dates, week_percentage: Math.round((weekCount / 7) * 100) }
    }))
    try {
      await toggleHabitLog(habitId, dateISO)
    } catch {
      load()
    }
  }

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      const habit = await createHabit({ name })
      setHabits(prev => [...prev, habit])
      setNewName('')
      inputRef.current?.focus()
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  function handleDeleteClick(habitId: string) {
    if (deleteConfirm === habitId) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      setDeleteConfirm(null)
      deleteHabit(habitId).then(() => {
        setHabits(prev => prev.filter(h => h.id !== habitId))
      }).catch(() => load())
    } else {
      setDeleteConfirm(habitId)
      deleteTimer.current = setTimeout(() => setDeleteConfirm(null), 2500)
    }
  }

  const weekLabel = `${formatDay(weekStart)} – ${formatDay(weekDates[6])} ${weekDates[6].getFullYear()}`

  return (
    <AppLayout>
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-black dark:text-white tracking-tight">Hábitos</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{weekLabel}</p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={prevWeek}
                className="w-9 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextWeek}
                className="w-9 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.08] rounded-2xl overflow-hidden">

            {/* Table scroll wrapper */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                    {/* Habit name column */}
                    <th className="text-left py-3 pl-5 pr-3 w-36 sm:w-44" />
                    {weekDates.map((d, i) => {
                      const iso = toISO(d)
                      const isToday = iso === today
                      return (
                        <th key={i} className="py-3 px-2 text-center">
                          <div className={cn(
                            'text-[10px] font-semibold tracking-widest',
                            isToday ? 'text-[#6B46E5] dark:text-[#AF9BFF]' : 'text-gray-400 dark:text-gray-500'
                          )}>
                            {DAYS_ES[i]}
                          </div>
                          <div className={cn(
                            'text-sm font-medium mt-0.5',
                            isToday ? 'text-[#6B46E5] dark:text-[#AF9BFF]' : 'text-gray-600 dark:text-gray-400'
                          )}>
                            {d.getDate()}
                          </div>
                        </th>
                      )
                    })}
                    {/* % column */}
                    <th className="py-3 px-3 text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider">%</th>
                    {/* Delete column */}
                    <th className="py-3 pr-4 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-white/[0.04]">
                        <td className="py-4 pl-5 pr-3">
                          <div className="h-4 w-24 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
                        </td>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="py-4 px-2 text-center">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse mx-auto" />
                          </td>
                        ))}
                        <td className="py-4 px-3">
                          <div className="h-4 w-8 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mx-auto" />
                        </td>
                        <td />
                      </tr>
                    ))
                  ) : habits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                        Agrega tu primer hábito abajo
                      </td>
                    </tr>
                  ) : (
                    habits.map(habit => (
                      <tr
                        key={habit.id}
                        className="border-b border-gray-50 dark:border-white/[0.04] last:border-0 group"
                      >
                        <td className="py-4 pl-5 pr-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {habit.name}
                          </span>
                        </td>
                        {weekDates.map((d, i) => {
                          const iso = toISO(d)
                          const done = habit.completed_dates.includes(iso)
                          const isToday = iso === today
                          return (
                            <td key={i} className="py-4 px-2 text-center">
                              <button
                                onClick={() => handleToggle(habit.id, iso)}
                                className={cn(
                                  'w-8 h-8 rounded-xl mx-auto flex items-center justify-center transition-all duration-150',
                                  done
                                    ? 'shadow-sm'
                                    : isToday
                                      ? 'border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                      : 'border-2 border-gray-200 dark:border-white/[0.12] hover:border-gray-300 dark:hover:border-white/20'
                                )}
                                style={done ? { backgroundColor: habit.color } : undefined}
                              >
                                {done && <Check size={14} strokeWidth={3} className="text-white" />}
                              </button>
                            </td>
                          )
                        })}
                        <td className="py-4 px-3 text-center">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: habit.week_percentage > 0 ? habit.color : undefined }}
                          >
                            {habit.week_percentage > 0
                              ? `${habit.week_percentage}%`
                              : <span className="text-gray-300 dark:text-gray-600">0%</span>
                            }
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-center">
                          <button
                            onClick={() => handleDeleteClick(habit.id)}
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100',
                              deleteConfirm === habit.id
                                ? 'bg-red-500 text-white opacity-100'
                                : 'text-gray-400 dark:text-gray-600 hover:text-red-400'
                            )}
                            title={deleteConfirm === habit.id ? 'Confirmar eliminar' : 'Eliminar'}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add habit row */}
            <div className="flex gap-3 p-4 border-t border-gray-100 dark:border-white/[0.06]">
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Nuevo hábito..."
                className="flex-1 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6B46E5]/40 focus:border-[#6B46E5] dark:focus:border-[#6B46E5] transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="px-5 py-2.5 bg-[#6B46E5] hover:bg-[#5a35d4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Agregar
              </button>
            </div>
          </div>

          {/* Week summary */}
          {habits.length > 0 && !loading && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Hábitos', value: habits.length, suffix: '' },
                {
                  label: 'Completados hoy',
                  value: habits.filter(h => h.completed_dates.includes(today)).length,
                  suffix: `/${habits.length}`,
                },
                {
                  label: 'Promedio semanal',
                  value: habits.length > 0
                    ? Math.round(habits.reduce((a, h) => a + h.week_percentage, 0) / habits.length)
                    : 0,
                  suffix: '%',
                },
                {
                  label: 'Racha máxima',
                  value: (() => {
                    let best = 0
                    habits.forEach(h => {
                      let streak = 0
                      for (let i = 6; i >= 0; i--) {
                        if (h.completed_dates.includes(toISO(weekDates[i]))) streak++
                        else break
                      }
                      if (streak > best) best = streak
                    })
                    return best
                  })(),
                  suffix: ' días',
                },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.08] rounded-xl px-4 py-3"
                >
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {stat.value}
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500">{stat.suffix}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
