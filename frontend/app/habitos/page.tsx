'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { getHabits, createHabit, deleteHabit, toggleHabitLog } from '@/lib/api'
import type { Habit } from '@/lib/types'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import HabitsWeekTable from '@/components/HabitsWeekTable'

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
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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

            {/* Habits table */}
            <HabitsWeekTable
              habits={habits}
              weekDates={weekDates}
              today={today}
              loading={loading}
              onToggle={handleToggle}
              onDelete={handleDeleteClick}
              deleteConfirm={deleteConfirm}
            />

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
