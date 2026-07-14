'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Habit } from '@/lib/types'

const DAYS_ES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

interface Props {
  habits: Habit[]
  weekDates: Date[]
  today: string
  loading?: boolean
  onToggle: (habitId: string, dateISO: string) => void
  onDelete?: (habitId: string) => void
  deleteConfirm?: string | null
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HabitsWeekTable({ habits, weekDates, today, loading, onToggle, onDelete, deleteConfirm }: Props) {
  const showDelete = !!onDelete

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-white/[0.04]">
                <td className="py-4 pl-4 pr-3">
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
                {showDelete && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        No hay hábitos aún
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-white/[0.06]">
            <th className="text-left py-3 pl-4 pr-3 w-36" />
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
            <th className="py-3 px-3 text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider">%</th>
            {showDelete && <th className="py-3 pr-4 w-8" />}
          </tr>
        </thead>
        <tbody>
          {habits.map(habit => (
            <tr
              key={habit.id}
              className="border-b border-gray-50 dark:border-white/[0.04] last:border-0 group"
            >
              <td className="py-4 pl-4 pr-3">
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
                      onClick={() => onToggle(habit.id, iso)}
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
              {showDelete && onDelete && (
                <td className="py-4 pr-4 text-center">
                  <button
                    onClick={() => onDelete(habit.id)}
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100',
                      deleteConfirm === habit.id
                        ? 'bg-red-500 text-white opacity-100'
                        : 'text-gray-400 dark:text-gray-600 hover:text-red-400'
                    )}
                    title={deleteConfirm === habit.id ? 'Confirmar eliminar' : 'Eliminar'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
