'use client'

/**
 * components/admin/BannerForm.tsx
 *
 * Slide 'banner' repetible (promos / contenido extra). Diseño FIJO:
 *  - Tamaño: Grande (default) o Chico (angosto).
 *  - Fondo: si subís una foto (en edición) → foto + overlay fijo; si no,
 *    se usa el Color de fondo.
 *  - "Ver más" opcional con texto en modal (editor enriquecido).
 * Reusa el patrón de los demás forms del header. defaultValues = fila.
 */

import { useActionState } from 'react'
import type { HeaderSlide } from '@/lib/supabase/queries/header_content'
import { RichTextEditor } from '@/components/admin/RichTextEditor'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  defaultValues?: Partial<HeaderSlide> | null
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

export function BannerForm({
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
        {contextLabel}. Diseño fijo: si hay foto se usa foto + overlay; si no,
        el color de fondo. Vacío = no se muestra ese campo.
      </div>

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

      {/* Formato */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Formato
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="narrow">Tamaño</Label>
            <select
              id="narrow"
              name="narrow"
              defaultValue={defaultValues?.narrow ? 'on' : ''}
              className={`${inputClass} bg-white`}
            >
              <option value="">Grande</option>
              <option value="on">Chico (angosto)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="bg" hint="se usa si NO hay foto — hex o rgba()">
              Color de fondo
            </Label>
            <input
              type="text"
              id="bg"
              name="bg"
              placeholder="#0a0a0a"
              defaultValue={defaultValues?.bg ?? ''}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          ¿Querés foto de fondo? Guardá primero; abajo aparece el uploader.
          Con foto, el texto va sobre un overlay oscuro (igual a los demás).
        </p>
      </fieldset>

      {/* Contenido */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eyebrow" hint="línea chica arriba">Eyebrow</Label>
            <input
              type="text"
              id="eyebrow"
              name="eyebrow"
              defaultValue={defaultValues?.eyebrow ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="title">Título</Label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={defaultValues?.title ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="body" hint="texto del banner — enriquecido">
              Body
            </Label>
            <RichTextEditor name="body" initialHTML={defaultValues?.body ?? ''} />
          </div>
        </div>
      </fieldset>

      {/* Ver más */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Modal “Ver más”
        </legend>
        <Label htmlFor="long_body" hint="si lo cargás, aparece “Ver más”">
          Texto largo
        </Label>
        <RichTextEditor
          name="long_body"
          initialHTML={defaultValues?.long_body ?? ''}
        />
      </fieldset>

      {/* Visibilidad */}
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
              defaultValue={defaultValues?.status ?? 'active'}
              className={`${inputClass} bg-white`}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="archived">Archivado</option>
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
              step={1}
              defaultValue={defaultValues?.sort_order ?? 100}
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
