'use client'

/**
 * components/admin/TipologiaAttrForm.tsx
 *
 * Form admin para tipologia_attrs (4 ejes nuevos: circulacion / morfologia /
 * acceso / area_social). En modo edit, `eje`, `valor` y `Ámbito` (marca/global)
 * quedan disabled — identifican la fila y cambiarlos rompería el match con
 * house_catalog.{eje}. `nombre` y `descripcion` son editables.
 */

import { useActionState } from 'react'
import {
  ATTR_EJES,
  ATTR_EJE_LABEL,
  type AttrEje,
  type TipologiaAttrRow,
} from '@/lib/supabase/queries/tipologia-attrs'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface MarcaOption {
  id: string
  name: string
}

interface Props {
  action: ActionFn
  marcas: MarcaOption[]
  defaultValues?: TipologiaAttrRow | null
  /** Pre-seleccionar eje al crear (cuando se entra desde el tab del listado). */
  presetEje?: AttrEje
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
        <span className="ml-2 normal-case tracking-normal text-neutral-300">
          {hint}
        </span>
      )}
    </label>
  )
}

export function TipologiaAttrForm({
  action,
  marcas,
  defaultValues,
  presetEje,
  isEdit = false,
  submitLabel = 'Guardar',
}: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  const ejeValue = defaultValues?.eje ?? presetEje ?? 'circulacion'
  const valorPlaceholder: Record<AttrEje, string> = {
    circulacion: 'EJES',
    morfologia: 'DECK',
    acceso: 'Frontal',
    area_social: 'Anterior',
  }
  const valorHint: Record<AttrEje, string> = {
    circulacion: 'MAYÚSCULAS — ej EJES / NODO',
    morfologia: 'MAYÚSCULAS — ej DECK / CUBO / ZETA',
    acceso: 'Title case — ej Frontal / Lateral / Flip',
    area_social: 'Title case — ej Anterior / Posterior / Lateral',
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Identidad
        </legend>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="eje" hint={isEdit ? 'no editable' : 'qué define'}>
                Eje *
              </Label>
              <select
                id="eje"
                name="eje"
                defaultValue={ejeValue}
                disabled={isEdit}
                className={`${inputClass} bg-white ${
                  isEdit
                    ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed'
                    : ''
                }`}
              >
                {ATTR_EJES.map((e) => (
                  <option key={e} value={e}>
                    {ATTR_EJE_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label
                htmlFor="valor"
                hint={isEdit ? 'no editable' : valorHint[ejeValue]}
              >
                Valor *
              </Label>
              <input
                type="text"
                id="valor"
                name="valor"
                defaultValue={defaultValues?.valor ?? ''}
                disabled={isEdit}
                required
                placeholder={valorPlaceholder[ejeValue]}
                maxLength={32}
                className={`${inputClass} font-mono ${
                  isEdit
                    ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed'
                    : ''
                }`}
              />
            </div>
            <div>
              <Label
                htmlFor="marca_id"
                hint={isEdit ? 'no editable' : 'quién la usa'}
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
                <option value="global">
                  Compartido (todas las marcas)
                </option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    Propietario · {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="nombre" hint="visible en filtros y comparativo">
              Nombre *
            </Label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              defaultValue={defaultValues?.nombre ?? ''}
              required
              placeholder="Circulación EJES"
              maxLength={80}
              className={inputClass}
            />
          </div>
          <p className="text-xs text-neutral-400">
            El <strong>valor</strong> matchea exacto contra{' '}
            <code>house_catalog.{ejeValue}</code> y entra al nombre comercial
            cuando corresponde. <strong>Compartido</strong>: lo administra CF,
            todas las marcas lo reutilizan. <strong>Propietario</strong>: solo
            esa marca lo ve, y pisa al compartido con el mismo (eje, valor).
          </p>
        </div>
      </fieldset>

      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido público
        </legend>
        <div>
          <Label
            htmlFor="descripcion"
            hint="1-2 oraciones — lo consume Ximia y la ficha"
          >
            Descripción
          </Label>
          <textarea
            id="descripcion"
            name="descripcion"
            defaultValue={defaultValues?.descripcion ?? ''}
            placeholder="Los servicios se alinean sobre un eje lateral o central, dejando el resto de la casa libre para crecer en torno a él."
            rows={4}
            className={inputClass}
          />
          <p className="text-xs text-neutral-400 mt-1">
            Texto explicativo del valor del eje. Lo usa el motor conversacional
            de Ximia para narrar la casa y aparece en la ficha + comparativo.
          </p>
        </div>
      </fieldset>

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
