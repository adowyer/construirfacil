'use client'

/**
 * components/admin/DeliveryConditionsForm.tsx
 *
 * Editor del bloque "Condiciones de Entrega" (CF global). Texto enriquecido
 * (Tiptap, Fase 8) → se sanea al guardar y se renderiza en la modal del
 * modelo con la clase .cf-richtext.
 */

import { useActionState } from 'react'
import type { DeliveryConditionsRow } from '@/lib/supabase/queries/delivery_conditions'
import { RichTextEditor } from '@/components/admin/RichTextEditor'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  defaultValues?: DeliveryConditionsRow | null
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

export function DeliveryConditionsForm({ action, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-xs text-neutral-500">
        Se muestra en una modal desde el pill “Condiciones de Entrega” sobre la
        galería de cada modelo. Usá <strong>negrita</strong> para los títulos
        (ej. “La casa perfecta.”) y separá en párrafos. Default de CF; vale
        para todas las casas.
      </div>

      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido
        </legend>
        <RichTextEditor name="body" initialHTML={defaultValues?.body ?? ''} />
      </fieldset>

      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Visibilidad
        </legend>
        <label
          htmlFor="status"
          className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
        >
          Estado
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? 'active'}
          className={`${inputClass} bg-white max-w-xs`}
        >
          <option value="active">Activo (se muestra)</option>
          <option value="inactive">Inactivo (oculto)</option>
          <option value="archived">Archivado</option>
        </select>
        <p className="text-xs text-neutral-400 mt-2">
          Inactivo/archivado → no aparece el pill en los modelos.
        </p>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
