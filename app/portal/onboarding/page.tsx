/**
 * app/portal/onboarding/page.tsx
 * New constructora registration form.
 * Only reached when the authenticated user has no constructora yet.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

export default function OnboardingPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    province: '',
    phone: '',
    website_url: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const slug = slugify(form.name)

    const { error: insertError } = await supabase.from('constructoras').insert({
      owner_id: user.id,
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      phone: form.phone.trim() || null,
      website_url: form.website_url.trim() || null,
      status: 'pending',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError(
          'Ya existe una constructora con ese nombre. Probá con un nombre diferente.',
        )
      } else {
        setError(insertError.message)
      }
      setLoading(false)
      return
    }

    router.push('/portal')
    router.refresh()
  }

  const PROVINCES = [
    'Buenos Aires',
    'CABA',
    'Catamarca',
    'Chaco',
    'Chubut',
    'Córdoba',
    'Corrientes',
    'Entre Ríos',
    'Formosa',
    'Jujuy',
    'La Pampa',
    'La Rioja',
    'Mendoza',
    'Misiones',
    'Neuquén',
    'Río Negro',
    'Salta',
    'San Juan',
    'San Luis',
    'Santa Cruz',
    'Santa Fe',
    'Santiago del Estero',
    'Tierra del Fuego',
    'Tucumán',
  ]

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Registrá tu constructora
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        Completá los datos de tu empresa. Un administrador revisará tu solicitud antes de que puedas publicar modelos.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Nombre de la constructora <span aria-hidden>*</span>
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
            <p className="text-xs text-neutral-400 mt-1">
              URL: /constructoras/{slugify(form.name)}
            </p>
          )}
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
                <option key={p} value={p}>
                  {p}
                </option>
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  )
}
