'use client'

import { useState } from 'react'
import type { MonthProjection } from '@/lib/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

interface Props {
  months: MonthProjection[]
  compareMonths?: MonthProjection[]
}

export default function ProjectionChart({ months, compareMonths }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  const accent = '#6B46E5'
  const coral = '#FF6B6B'

  const allValues = [
    ...months.map(m => m.available),
    ...(compareMonths ?? []).map(m => m.available),
  ]
  const maxAbs = Math.max(...allValues.map(Math.abs), 1)
  const chartHeight = 160

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5 h-[200px] relative">
        {/* Zero line */}
        <div
          className="absolute left-0 right-0 border-t border-black/10 dark:border-white/10"
          style={{ bottom: `${chartHeight / 2}px` }}
        />

        {months.map((m, i) => {
          const comp = compareMonths?.[i]
          const barH = Math.abs(m.available) / maxAbs * (chartHeight / 2)
          const isNeg = m.available < 0
          const isHovered = hovered === i
          const compBarH = comp ? Math.abs(comp.available) / maxAbs * (chartHeight / 2) : 0
          const compIsNeg = comp ? comp.available < 0 : false

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-0.5 relative cursor-pointer"
              style={{ height: '200px', justifyContent: 'flex-end' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-2 z-10 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 rounded-xl p-2.5 text-xs whitespace-nowrap shadow-xl">
                  <p className="font-semibold text-black dark:text-white mb-1">{m.label}</p>
                  <p className="text-black/50 dark:text-white/50">Ingreso: <span className="text-black dark:text-white">{fmt(m.income)}</span></p>
                  <p className="text-black/50 dark:text-white/50">Recurrentes: <span style={{ color: coral }}>−{fmt(m.recurring_expenses)}</span></p>
                  <p className="text-black/50 dark:text-white/50">MSI: <span style={{ color: coral }}>−{fmt(m.installments)}</span></p>
                  <p className="text-black/50 dark:text-white/50">Ahorro: <span className="text-amber-500 dark:text-amber-400">−{fmt(m.savings_contributions)}</span></p>
                  <div className="mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/10">
                    <p className="text-black/50 dark:text-white/50">Disponible:{' '}
                      <span style={{ color: isNeg ? coral : accent }} className="font-semibold">{fmt(m.available)}</span>
                    </p>
                    {comp && (
                      <p className="text-black/50 dark:text-white/50 mt-0.5">Con MSI:{' '}
                        <span style={{ color: compIsNeg ? coral : '#F59E0B' }} className="font-semibold">{fmt(comp.available)}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Bars area */}
              <div className="flex items-end gap-0.5 w-full px-0.5" style={{ height: `${chartHeight}px` }}>
                <div
                  className="flex-1 rounded-sm transition-all duration-150"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: isNeg ? coral : isHovered ? accent : `${accent}b3`,
                    alignSelf: isNeg ? 'flex-start' : 'flex-end',
                    marginTop: isNeg ? `${chartHeight / 2 - barH}px` : '0',
                  }}
                />
                {comp && (
                  <div
                    className="flex-1 rounded-sm transition-all duration-150 opacity-70"
                    style={{
                      height: `${compBarH}px`,
                      backgroundColor: compIsNeg ? `${coral}80` : '#F59E0B99',
                      alignSelf: compIsNeg ? 'flex-start' : 'flex-end',
                      marginTop: compIsNeg ? `${chartHeight / 2 - compBarH}px` : '0',
                    }}
                  />
                )}
              </div>

              {/* Month label */}
              <span className="text-[10px] text-black/30 dark:text-white/30 leading-none pb-0.5">
                {m.label.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>

      {compareMonths && (
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `${accent}b3` }} />
            <span className="text-xs text-black/40 dark:text-white/40">Sin el MSI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-amber-400/60" />
            <span className="text-xs text-black/40 dark:text-white/40">Con el MSI</span>
          </div>
        </div>
      )}
    </div>
  )
}
