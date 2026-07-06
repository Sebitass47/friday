'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { getCategories, createCategory, deleteCategory } from '@/lib/api'
import type { CategoriesResponse } from '@/lib/types'

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

export function CategorySelector({ value, onChange, required, className }: CategorySelectorProps) {
  const [data, setData] = useState<CategoriesResponse>({ default: [], custom: [] })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allCategories = [
    ...data.default.map(name => ({ id: `default_${name}`, name, isDefault: true })),
    ...data.custom.map(c => ({ id: c.id, name: c.name, isDefault: false })),
  ]

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const created = await createCategory(trimmed)
      setData(prev => ({ ...prev, custom: [...prev.custom, created] }))
      onChange(trimmed)
      setNewName('')
      setAdding(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    try {
      await deleteCategory(id)
      setData(prev => ({ ...prev, custom: prev.custom.filter(c => c.id !== id) }))
      if (value === name) onChange('')
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-black/40 dark:text-white/30 ${className ?? ''}`}>
        <Loader2 size={12} className="animate-spin" />
        Cargando categorías…
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex flex-wrap gap-1.5">
        {allCategories.map(cat => {
          const selected = value === cat.name
          return (
            <div key={cat.id} className="group relative">
              <button
                type="button"
                onClick={() => onChange(selected ? '' : cat.name)}
                className={`relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selected
                    ? 'bg-[#6B46E5]/15 dark:bg-[#AF9BFF]/15 border-[#6B46E5]/40 dark:border-[#AF9BFF]/40 text-[#6B46E5] dark:text-[#AF9BFF]'
                    : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/10 dark:border-white/10 text-black/60 dark:text-white/50 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white'
                }`}
              >
                {cat.name}
              </button>
              {!cat.isDefault && (
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/20 dark:bg-white/20 text-white dark:text-black hover:bg-red-500 hover:text-white transition-all"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          )
        })}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-dashed border-black/15 dark:border-white/15 text-black/40 dark:text-white/30 hover:border-black/30 dark:hover:border-white/30 hover:text-black/60 dark:hover:text-white/50 transition-all"
          >
            <Plus size={10} />
            Nueva
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
            placeholder="Nombre de categoría"
            className="flex-1 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-black dark:text-white outline-none focus:border-[#6B46E5] dark:focus:border-[#AF9BFF] transition-colors"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="px-2.5 py-1 rounded-lg text-xs bg-[#6B46E5] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? '…' : 'Agregar'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName('') }}
            className="p-1 rounded-lg text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {required && !value && (
        <p className="text-[10px] text-[#FF6B6B]">Selecciona una categoría</p>
      )}
    </div>
  )
}
