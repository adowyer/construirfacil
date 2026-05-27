'use client'

/**
 * components/admin/TipologiaForm.tsx
 *
 * Form admin para la librería de tipologías arquitectónicas.
 * En modo edit, `code` y `Ámbito` (marca/global) quedan disabled — identifican
 * la fila y cambiarlos rompería la resolución del catálogo. `descripcion`
 * sigue editable (es el texto que sale en la ficha de la casa).
 */

import { useActionState } from 'react'
import type { TipologiaRow } from '@/lib/supabase/queries/tipologia'

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
  defaultValues?: TipologiaRow | null
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

export function TipologiaForm({
  action,
  marcas,
  defaultValues,
  isEdit = false,
  submitLabel = 'Guardar',
}: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      {/* ── Identidad ─────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Identidad
        </legend>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="code"
                hint={isEdit ? 'no editable' : 'ej. EJE, NODO, ZETA, DECK'}
              >
                Code *
              </Label>
              <input
                type="text"
                id="code"
                name="code"
                defaultValue={defaultValues?.code ?? ''}
                disabled={isEdit}
                required
                placeholder="EJE"
                maxLength={16}
                className={`${inputClass} font-mono uppercase ${
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
            <Label htmlFor="nombre" hint="visible en la ficha">
              Nombre *
            </Label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              defaultValue={defaultValues?.nombre ?? ''}
              required
              placeholder="Tipología EJE"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-neutral-400">
            El <strong>code</strong> entra al nombre comercial:{' '}
            <code>CASA &lt;CODE&gt; Estilo &lt;ESTILO&gt;</code>. Cada SKU del
            catálogo apunta a este code via{' '}
            <code>house_catalog.tipologia_code_new</code>.{' '}
            <strong>Compartido</strong>: lo administra CF, todas las marcas lo
            reutilizan. <strong>Propietario</strong>: solo esa marca lo ve, y
            pisa al compartido con el mismo code.
          </p>
        </div>
      </fieldset>

      {/* ── Contenido público ─────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido público
        </legend>
        <div>
          <Label htmlFor="descripcion" hint="explicación del partido arquitectónico">
            Descripción
          </Label>
          <textarea
            id="descripcion"
            name="descripcion"
            defaultValue={defaultValues?.descripcion ?? ''}
            placeholder="Arquitectura diseñada en torno a un eje lateral o central."
            rows={4}
            className={inputClass}
          />
          <p className="text-xs text-neutral-400 mt-1">
            Texto corto (1-2 oraciones) que aparece en la ficha de cada casa
            como bajada de "Distribución arquitectónica".
          </p>
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
