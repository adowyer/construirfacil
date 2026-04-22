/**
 * app/admin/attributes/[id]/AttributeTypeEditForm.tsx
 * Client form for editing an attribute type.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AttributeTypeWithValues } from '@/types/database'

interface Props {
  type: AttributeTypeWithValues
}

export default function AttributeTypeEditForm({ type }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: type.name,
    description: type.description ?? '',
    sort_order: String(type.sort_order),
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setSaved(false)
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('attribute_types')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        sort_order: parseInt(form.sort_order, 10) || 0,
      })
      .eq('id', type.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-8">
      <div>
        <label htmlFor="name" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Descripción (nota interna)
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
        />
      </div>

      <div>
        <label htmlFor="sort_order" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Orden
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          value={form.sort_order}
          onChange={handleChange}
          min={0}
          className="w-32 border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {saved && <p className="text-sm text-green-600">Guardado.</p>}
        <Link
          href="/admin/attributes"
          className="text-sm text-neutral-400 hover:text-black transition-colors underline ml-auto"
        >
          Volver
        </Link>
      </div>
    </form>
  )
}
