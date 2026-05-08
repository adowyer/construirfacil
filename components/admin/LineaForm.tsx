'use client'

/**
 * components/admin/LineaForm.tsx
 *
 * Form admin único para crear/editar una línea (entidad `lineas`) y su
 * contenido editorial (`line_content` con tipologia_code = NULL).
 *
 * Campos editoriales (title, subtitle) se guardan en line_content.
 * `description` se escribe a la vez en lineas.description y line_content.body.
 *
 * El name se normaliza server-side (uppercase + trim) para mantener
 * consistencia con house_catalog.linea (poblada por trigger).
 */

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/utils'
import type { LineaRow, LineContentRow } from '@/lib/supabase/queries/lineas'
import type { Marca } from '@/types/database'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface LineaFormProps {
  action: ActionFn
  marcas: Pick<Marca, 'id' | 'name'>[]
  defaultLinea?: LineaRow | null
  defaultContent?: LineContentRow | null
  defaultMarcaId?: string
  submitLabel?: string
}

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
      {hint && (
        <span className="ml-2 normal-case tracking-normal text-neutral-300">{hint}</span>
      )}
    </label>
  )
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

export function LineaForm({
  action,
  marcas,
  defaultLinea,
  defaultContent,
  defaultMarcaId,
  submitLabel = 'Guardar',
}: LineaFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  // Slug autogenerado desde name si el usuario no editó manualmente.
  const [name, setName] = useState<string>(defaultLinea?.name ?? '')
  const [slug, setSlug] = useState<string>(defaultLinea?.slug ?? '')
  const [slugDirty, setSlugDirty] = useState<boolean>(!!defaultLinea?.slug)
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
            <Label htmlFor="marca_id">Marca *</Label>
            <select
              id="marca_id"
              name="marca_id"
              defaultValue={defaultLinea?.marca_id ?? defaultMarcaId ?? ''}
              required
              className={`${inputClass} bg-white`}
            >
              <option value="" disabled>
                — elegí una marca —
              </option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="name" hint="se guarda en MAYÚSCULAS">
              Nombre *
            </Label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ej. ATLAS"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="slug" hint="auto desde el nombre">
              URL slug *
            </Label>
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
              placeholder="ej. atlas"
              className={inputClass}
            />
          </div>

          <div>
            <Label htmlFor="hero_image_url">Hero image (URL)</Label>
            <input
              type="url"
              id="hero_image_url"
              name="hero_image_url"
              defaultValue={defaultLinea?.hero_image_url ?? ''}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Contenido editorial ───────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="title">Título (slider público)</Label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={defaultContent?.title ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline corto</Label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              defaultValue={defaultLinea?.tagline ?? ''}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <Label htmlFor="subtitle">Subtítulo (slider público)</Label>
          <input
            type="text"
            id="subtitle"
            name="subtitle"
            defaultValue={defaultContent?.subtitle ?? ''}
            className={inputClass}
          />
        </div>

        <div>
          <Label
            htmlFor="description"
            hint="se usa en la ficha de la línea y en el slider público"
          >
            Descripción
          </Label>
          <textarea
            id="description"
            name="description"
            defaultValue={defaultLinea?.description ?? defaultContent?.body ?? ''}
            rows={5}
            className={`${inputClass} resize-none`}
          />
        </div>
      </fieldset>

      {/* ── Visibilidad y orden ───────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Visibilidad
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Estado</Label>
            <select
              id="status"
              name="status"
              defaultValue={defaultLinea?.status ?? 'active'}
              className={`${inputClass} bg-white`}
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
              <option value="archived">Archivada</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sort_order" hint="menor = aparece antes">
              Orden
            </Label>
            <input
              type="number"
              id="sort_order"
              name="sort_order"
              defaultValue={defaultLinea?.sort_order ?? 0}
              step={1}
              className={inputClass}
            />
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
