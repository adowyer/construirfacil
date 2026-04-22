/**
 * app/admin/attributes/[id]/values/AttributeValuesManager.tsx
 * Client component — add and delete attribute values.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AttributeTypeWithValues, AttributeValue } from '@/types/database'

interface Props {
  type: AttributeTypeWithValues
}

export default function AttributeValuesManager({ type }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<AttributeValue[]>(type.attribute_values)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim()) return
    setError(null)
    setAdding(true)

    const supabase = createClient()
    const maxOrder = values.reduce((max, v) => Math.max(max, v.sort_order), 0)

    const { data, error: insertError } = await supabase
      .from('attribute_values')
      .insert({
        attribute_type_id: type.id,
        label: newLabel.trim(),
        sort_order: maxOrder + 10,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setAdding(false)
      return
    }

    setValues((prev) => [...prev, data])
    setNewLabel('')
    setAdding(false)
    router.refresh()
  }

  async function handleDelete(valueId: string) {
    if (!confirm('¿Eliminar este valor? Se eliminará de todos los modelos que lo tengan asignado.')) return
    setDeletingId(valueId)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('attribute_values')
      .delete()
      .eq('id', valueId)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingId(null)
      return
    }

    setValues((prev) => prev.filter((v) => v.id !== valueId))
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div>
      {/* Existing values */}
      {values.length === 0 ? (
        <p className="text-neutral-400 text-sm mb-8">
          Este tipo no tiene valores aún.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200 mb-8">
          {values.map((val) => (
            <div
              key={val.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm">{val.label}</span>
              <button
                onClick={() => handleDelete(val.id)}
                disabled={deletingId === val.id}
                className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                aria-label={`Eliminar ${val.label}`}
              >
                {deletingId === val.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new value */}
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nuevo valor (ej. Doble vidriado)"
          required
          className="flex-1 border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
        />
        <button
          type="submit"
          disabled={adding || !newLabel.trim()}
          className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {adding ? 'Agregando...' : 'Agregar'}
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
