'use client'

/**
 * components/admin/HomeSlideForm.tsx
 *
 * Form de un slide del HomeRow: contenido (texto) + visual (bg, colores,
 * narrow, CTA). El slot/versión no se editan acá (identity). Campos vacíos
 * → el HomeRow usa el default de home-defaults.ts.
 */

import { useActionState } from 'react'
import type { HomeSlide } from '@/lib/supabase/queries/home_content'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  defaultValues?: Partial<HomeSlide> | null
  contextLabel: string
  submitLabel?: string
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

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
        <span className="ml-2 normal-case tracking-normal text-neutral-300">
          {hint}
        </span>
      )}
    </label>
  )
}

export function HomeSlideForm({
  action,
  defaultValues,
  contextLabel,
  submitLabel = 'Guardar cambios',
}: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-xs text-neutral-500">
        {contextLabel}. Dejá un campo vacío para usar el valor por defecto del
        slot.
      </div>

      {/* Identificación (interno) */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Identificación
        </legend>
        <Label
          htmlFor="admin_label"
          hint="solo para vos — no se muestra en el catálogo"
        >
          Nombre interno
        </Label>
        <input
          type="text"
          id="admin_label"
          name="admin_label"
          placeholder="Ej: Banner Uno, Campaña Neuquén…"
          defaultValue={defaultValues?.admin_label ?? ''}
          className={inputClass}
        />
      </fieldset>

      {/* Contenido */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eyebrow" hint="línea chica arriba">Eyebrow</Label>
            <input type="text" id="eyebrow" name="eyebrow"
              defaultValue={defaultValues?.eyebrow ?? ''} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="label" hint="título del slide">Título</Label>
            <input type="text" id="label" name="label"
              defaultValue={defaultValues?.label ?? ''} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <textarea id="body" name="body" rows={4}
              defaultValue={defaultValues?.body ?? ''}
              className={`${inputClass} resize-none`} />
          </div>
        </div>
      </fieldset>

      {/* CTA */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          CTA
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="cta_style">Estilo</Label>
            <select id="cta_style" name="cta_style"
              defaultValue={defaultValues?.cta_style ?? 'none'}
              className={`${inputClass} bg-white`}>
              <option value="none">Sin botón</option>
              <option value="primary">Primario</option>
              <option value="ghost">Ghost</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cta_label">Texto del botón</Label>
            <input type="text" id="cta_label" name="cta_label"
              defaultValue={defaultValues?.cta_label ?? ''} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="cta_url" hint="opcional">URL</Label>
            <input type="text" id="cta_url" name="cta_url"
              defaultValue={defaultValues?.cta_url ?? ''} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          “Sin botón” = sin CTA. Si hay botón, abre el catálogo (o la URL).
        </p>
      </fieldset>

      {/* Visual */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Visual
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="bg" hint="hex o rgba()">Fondo</Label>
            <input type="text" id="bg" name="bg" placeholder="#0a0a0a"
              defaultValue={defaultValues?.bg ?? ''} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="text_color" hint="título/eyebrow">Color texto</Label>
            <input type="text" id="text_color" name="text_color" placeholder="#ffffff"
              defaultValue={defaultValues?.text_color ?? ''} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="body_color" hint="párrafo">Color body</Label>
            <input type="text" id="body_color" name="body_color"
              defaultValue={defaultValues?.body_color ?? ''} className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-neutral-700">
          <input type="checkbox" name="narrow"
            defaultChecked={defaultValues?.narrow ?? false}
            className="h-4 w-4 accent-[#ff003d]" />
          Slide angosto (rompe el ritmo del marquee)
        </label>
        <p className="text-xs text-neutral-400 mt-2">
          La foto de fondo se sube abajo (en edición). Si no hay foto, se usa
          el color de fondo.
        </p>
      </fieldset>

      {/* Visibilidad */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Visibilidad
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Estado</Label>
            <select id="status" name="status"
              defaultValue={defaultValues?.status ?? 'active'}
              className={`${inputClass} bg-white`}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sort_order" hint="menor = antes">Orden</Label>
            <input type="number" id="sort_order" name="sort_order" step={1}
              defaultValue={defaultValues?.sort_order ?? 0} className={inputClass} />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50">
          {isPending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
