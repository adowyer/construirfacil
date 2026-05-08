'use client'

/**
 * components/admin/MarcaForm.tsx
 *
 * Form admin para crear/editar marcas.
 * Campos editables del schema `marcas`: name, slug, description, logo_url,
 * website_url, phone, city, province.
 *
 * El slug se autogenera del name si se deja vacío.
 * Status (pending/approved/rejected) NO se edita acá — usar los botones
 * Aprobar / Rechazar en la página de detalle.
 */

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/utils'
import type { Marca } from '@/types/database'

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface MarcaFormProps {
  action: ActionFn
  defaultValues?: Partial<Marca>
  submitLabel?: string
}

function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
      {hint && <span className="ml-2 normal-case tracking-normal text-neutral-300">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

export function MarcaForm({
  action,
  defaultValues,
  submitLabel = 'Guardar',
}: MarcaFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  // Slug autogenerado: si el usuario no editó manualmente el slug, lo derivamos
  // del name al vuelo.
  const [name, setName] = useState<string>(defaultValues?.name ?? '')
  const [slug, setSlug] = useState<string>(defaultValues?.slug ?? '')
  const [slugDirty, setSlugDirty] = useState<boolean>(!!defaultValues?.slug)

  const computedSlug = slugDirty ? slug : slugify(name)

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      {/* ── Identificación ────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Identificación
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ej. HAUSIND"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="slug" hint="auto desde el nombre">URL slug *</Label>
            <input
              type="text"
              id="slug"
              name="slug"
              value={computedSlug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugDirty(true)
              }}
              required
              placeholder="ej. hausind"
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="description">Descripción</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={defaultValues?.description ?? ''}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </fieldset>

      {/* ── Contacto y web ────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contacto y web
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <input
              type="tel"
              id="phone"
              name="phone"
              defaultValue={defaultValues?.phone ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="website_url">Sitio web</Label>
            <input
              type="url"
              id="website_url"
              name="website_url"
              defaultValue={defaultValues?.website_url ?? ''}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <input
              type="text"
              id="city"
              name="city"
              defaultValue={defaultValues?.city ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="province">Provincia</Label>
            <select
              id="province"
              name="province"
              defaultValue={defaultValues?.province ?? ''}
              className={`${inputClass} bg-white`}
            >
              <option value="">— sin provincia —</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
