'use client'

/**
 * components/admin/BrandContentForm.tsx
 *
 * Form admin para crear/editar `brand_content`.
 * En modo edit, `key` queda disabled (no se puede cambiar — rompería las
 * referencias del catálogo público que filtra por key).
 */

import { useActionState } from 'react'
import type { BrandContentRow } from '@/lib/supabase/queries/brand-content'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface MarcaOption {
  id: string
  name: string
}

interface BrandContentFormProps {
  action: ActionFn
  marcas: MarcaOption[]
  defaultValues?: BrandContentRow | null
  isEdit?: boolean
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
        <span className="ml-2 normal-case tracking-normal text-neutral-300">{hint}</span>
      )}
    </label>
  )
}

export function BrandContentForm({
  action,
  marcas,
  defaultValues,
  isEdit = false,
  submitLabel = 'Guardar',
}: BrandContentFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
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
            <Label
              htmlFor="key"
              hint={isEdit ? 'no editable' : 'identificador único'}
            >
              Key *
            </Label>
            <input
              type="text"
              id="key"
              name="key"
              defaultValue={defaultValues?.key ?? ''}
              required={!isEdit}
              disabled={isEdit}
              placeholder="ej. concept, system_wood, brand_values"
              className={`${inputClass} ${isEdit ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <Label htmlFor="label">Label *</Label>
            <input
              type="text"
              id="label"
              name="label"
              defaultValue={defaultValues?.label ?? ''}
              required
              placeholder="Nombre descriptivo (uso interno)"
              className={inputClass}
            />
          </div>
          <div>
            <Label
              htmlFor="marca_id"
              hint={isEdit ? 'no editable' : 'global = todas las marcas'}
            >
              Ámbito *
            </Label>
            <select
              id="marca_id"
              name="marca_id"
              defaultValue={defaultValues?.marca_id ?? 'global'}
              disabled={isEdit}
              className={`${inputClass} bg-white ${
                isEdit
                  ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed'
                  : ''
              }`}
            >
              <option value="global">Global (todas las marcas)</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          <strong>Global</strong>: lo ve el agregador y cualquier marca sin
          override propio. <strong>Marca</strong>: pisa al global del mismo key
          solo en el catálogo de esa marca.
        </p>
      </fieldset>

      {/* ── Contenido público ─────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido público
        </legend>
        <div className="space-y-4">
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
            <Label htmlFor="subtitle">Subtítulo</Label>
            <input
              type="text"
              id="subtitle"
              name="subtitle"
              defaultValue={defaultValues?.subtitle ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              name="body"
              defaultValue={defaultValues?.body ?? ''}
              rows={6}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </fieldset>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Call to action (opcional)
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cta_label">CTA label</Label>
            <input
              type="text"
              id="cta_label"
              name="cta_label"
              defaultValue={defaultValues?.cta_label ?? ''}
              placeholder="Ej. Conocer más"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="cta_url">CTA URL</Label>
            <input
              type="url"
              id="cta_url"
              name="cta_url"
              defaultValue={defaultValues?.cta_url ?? ''}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* ── Visibilidad ─────────────────────────────────────────── */}
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
