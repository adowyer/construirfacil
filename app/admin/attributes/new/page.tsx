/**
 * app/admin/attributes/new/page.tsx
 * Create a new attribute type.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

export default function NewAttributeTypePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', description: '', sort_order: '0' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('attribute_types').insert({
      name: form.name.trim(),
      slug: slugify(form.name),
      description: form.description.trim() || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/admin/attributes')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/attributes" className="hover:text-black transition-colors">
          Atributos
        </Link>
        {' / '}
        <span className="text-black">Nuevo tipo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-8">
        Nuevo tipo de atributo
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Nombre <span aria-hidden>*</span>
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
          {form.name && (
            <p className="text-xs text-neutral-400 mt-1">Slug: {slugify(form.name)}</p>
          )}
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
            Orden de visualización
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

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear tipo'}
          </button>
          <Link
            href="/admin/attributes"
            className="border border-neutral-300 px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:border-black transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
