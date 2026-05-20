'use client'

/**
 * components/admin/LineContentTipologiaForm.tsx
 *
 * Form admin chico para editar una fila de `line_content` keyed por
 * (linea, tipologia_code). Ej: 'estilos_intro' de la línea TERRA → renderiza
 * un bloque con title / subtitle / body. El submit usa una server action
 * bound al (lineaName, tipologiaCode, lineaId) desde la page.
 *
 * El editor "primario" (line_content con tipologia_code IS NULL) sigue en
 * LineaForm. Este componente es para los rows "secundarios" por tipología
 * que el catálogo público consume en slides específicos del expandido.
 */

import { useActionState } from 'react'
import type { LineContentRow } from '@/lib/supabase/queries/lineas'
import { RichTextEditor } from '@/components/admin/RichTextEditor'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface LineContentTipologiaFormProps {
  action: ActionFn
  tipologiaCode: string
  defaultValues?: LineContentRow | null
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
    </label>
  )
}

export function LineContentTipologiaForm({
  action,
  tipologiaCode,
  defaultValues,
}: LineContentTipologiaFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null })

  const id = (s: string) => `${tipologiaCode}-${s}`

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
          Tipología:{' '}
          <code className="font-mono text-[#0a0a0a]">{tipologiaCode}</code>
        </h3>
        <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
          line_content
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={id('title')}>Título</Label>
          <input
            id={id('title')}
            name="title"
            type="text"
            defaultValue={defaultValues?.title ?? ''}
            className={inputClass}
            placeholder="ej. Estilos"
          />
        </div>
        <div>
          <Label htmlFor={id('subtitle')}>Subtítulo</Label>
          <input
            id={id('subtitle')}
            name="subtitle"
            type="text"
            defaultValue={defaultValues?.subtitle ?? ''}
            className={inputClass}
            placeholder="ej. Maneras de habitar"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={id('body')}>Cuerpo</Label>
        <RichTextEditor name="body" initialHTML={defaultValues?.body ?? ''} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={id('sort_order')}>Sort order</Label>
          <input
            id={id('sort_order')}
            name="sort_order"
            type="number"
            defaultValue={defaultValues?.sort_order ?? 0}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor={id('status')}>Status</Label>
          <select
            id={id('status')}
            name="status"
            defaultValue={defaultValues?.status ?? 'active'}
            className={inputClass}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#ff003d] text-white text-xs uppercase tracking-widest font-semibold px-5 py-2.5 rounded-lg hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
