'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  value: string          // yyyy-mm-dd (empty string = no date)
  onChange: (v: string) => void  // returns yyyy-mm-dd
  className?: string             // outer wrapper (layout: width, flex, etc.)
  inputClassName?: string        // overrides for the text input visuals
  placeholder?: string
  clearable?: boolean            // show ✕ button when value is set
}

function toDisplay(iso: string): string {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function toISO(display: string): string {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  // Basic range validation before returning
  const di = parseInt(d), mi = parseInt(m), yi = parseInt(y)
  if (mi < 1 || mi > 12 || di < 1 || di > 31 || yi < 2000) return ''
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

const defaultInputCls =
  'w-full text-[13px] bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-black/80 dark:text-white/80 placeholder-black/30 dark:placeholder-white/20 outline-none focus:border-[#6B46E5]/40 transition-colors'

export function DateInput({ value, onChange, className, inputClassName, placeholder = 'dd/mm/aaaa', clearable }: DateInputProps) {
  const [text, setText] = useState(() => toDisplay(value))
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(toDisplay(value)) }, [value])

  function handleText(raw: string) {
    // Auto-format: strip non-digits, re-insert slashes at pos 2 and 5
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    let fmt = digits
    if (digits.length > 2) fmt = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) fmt = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)

    setText(fmt)
    if (fmt === '') { onChange(''); return }
    const iso = toISO(fmt)
    if (iso) onChange(iso)
  }

  function handleNative(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value  // native picker always returns yyyy-mm-dd
    onChange(iso)
    setText(toDisplay(iso))
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => nativeRef.current?.showPicker?.()}
        tabIndex={-1}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-[#6B46E5] dark:hover:text-[#AF9BFF] transition-colors z-10"
      >
        <Calendar size={14} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={e => handleText(e.target.value)}
        placeholder={placeholder}
        maxLength={10}
        className={cn(defaultInputCls, clearable && value ? 'pr-7' : '', inputClassName)}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => { onChange(''); setText('') }}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors z-10"
        >
          <X size={13} />
        </button>
      )}
      {/* Hidden native date picker — opened by the calendar button */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={handleNative}
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
      />
    </div>
  )
}
