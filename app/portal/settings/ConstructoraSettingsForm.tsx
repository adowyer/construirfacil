/**
 * app/portal/settings/ConstructoraSettingsForm.tsx
 * Client component — constructora brand settings form.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Constructora } from '@/types/database'

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

interface Props {
  constructora: Constructora
}

export default function ConstructoraSettingsForm({ constructora }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    description: constructora.description ?? '',
    city: constructora.city ?? '',
    province: constructora.province ?? '',
    phone: constructora.phone ?? '',
    website_url: constructora.website_url ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setSaved(false)
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('constructoras')
      .update({
        description: form.description.trim() || null,
        city: form.city.trim() || null,
        province: form.province || null,
        phone: form.phone.trim() || null,
        website_url: form.website_url.trim() || null,
      })
      .eq('id', constructora.id)

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name is read-only — would require admin review to change */}
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2">
          Nombre
        </p>
        <p className="text-sm font-semibold border border-neutral-100 bg-neutral-50 px-4 py-3">
          {constructora.name}
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          Para cambiar el nombre contactá con soporte.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Ciudad
          </label>
          <input
            id="city"
            name="city"
            type="text"
            value={form.city}
            onChange={handleChange}
            className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
          />
        </div>
        <div>
          <label htmlFor="province" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Provincia
          </label>
          <select
            id="province"
            name="province"
            value={form.province}
            onChange={handleChange}
            className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-white"
          >
            <option value="">Seleccionar</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Teléfono
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      <div>
        <label htmlFor="website_url" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Sitio web
        </label>
        <input
          id="website_url"
          name="website_url"
          type="url"
          value={form.website_url}
          onChange={handleChange}
          placeholder="https://"
          className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {saved && (
          <p className="text-sm text-green-600">Guardado correctamente.</p>
        )}
      </div>
    </form>
  )
}
