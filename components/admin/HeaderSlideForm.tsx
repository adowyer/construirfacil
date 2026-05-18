'use client'

/**
 * components/admin/HeaderSlideForm.tsx
 *
 * Form de contenido de un slide del header. El identity (tipo de slide /
 * versión) NO se edita acá — se fija al crear/asegurar la fila y se muestra
 * como contexto. Campos vacíos → NULL → HeroRow cae al hardcoded del slide.
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
  /** Texto de contexto, ej. "crece · versión B2C" o "pasos · pinned". */
  contextLabel: string
  /** El slide tiene foto principal (crece/flex/linea-card). */
  showImageHint?: boolean
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

export function HeaderSlideForm({
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
        {contextLabel}. Dejá un campo vacío para que el catálogo use el texto
        por defecto de ese slide.
      </div>

      {/* ── Identificación (interno) ──────────────────────────────── */}
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

      {/* ── Contenido del slide ───────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eyebrow" hint="línea chica arriba del título">
              Eyebrow
            </Label>
            <input
              type="text"
              id="eyebrow"
              name="eyebrow"
              defaultValue={defaultValues?.eyebrow ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="title" hint="título principal del slide">
              Título
            </Label>
            <textarea
              id="title"
              name="title"
              defaultValue={defaultValues?.title ?? ''}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <Label htmlFor="subtitle" hint="subtítulo (ej. sub de card de línea)">
              Subtítulo
            </Label>
            <input
              type="text"
              id="subtitle"
              name="subtitle"
              defaultValue={defaultValues?.subtitle ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="body" hint="texto del slide / teaser — formato enriquecido">
              Body
            </Label>
            <RichTextEditor name="body" initialHTML={defaultValues?.body ?? ''} />
          </div>
        </div>
      </fieldset>

      {/* ── Modal "Ver más" ───────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Modal “Ver más”
        </legend>
        <Label htmlFor="long_body" hint="si lo cargás, aparece el botón “Ver más”">
          Texto largo
        </Label>
        <RichTextEditor
          name="long_body"
          initialHTML={defaultValues?.long_body ?? ''}
        />
        <p className="text-xs text-neutral-400 mt-1">
          Vacío = sin “Ver más” (o el modal por defecto del slide). El slider
          de fotos del modal se administra en una etapa posterior.
        </p>
      </fieldset>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          CTA (opcional)
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cta_label">Texto del botón</Label>
            <input
              type="text"
              id="cta_label"
              name="cta_label"
              defaultValue={defaultValues?.cta_label ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="cta_url">URL</Label>
            <input
              type="text"
              id="cta_url"
              name="cta_url"
              defaultValue={defaultValues?.cta_url ?? ''}
              placeholder="https://… o /ruta"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Visibilidad ───────────────────────────────────────────── */}
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
              defaultValue={defaultValues?.sort_order ?? 0}
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
