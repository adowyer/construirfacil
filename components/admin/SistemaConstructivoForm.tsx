'use client'

/**
 * components/admin/SistemaConstructivoForm.tsx
 *
 * Form admin para la librería de sistemas constructivos.
 * El nombre genera el slug al crear. En modo edit, `slug` y `Ámbito`
 * (marca/global) quedan disabled — identifican la fila y cambiarlos rompería
 * la resolución del catálogo.
 */

import { useActionState } from 'react'
import type { SistemaConstructivoRow } from '@/lib/supabase/queries/sistema-constructivo'

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
  defaultValues?: SistemaConstructivoRow | null
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

export function SistemaConstructivoForm({
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
          <div>
            <Label htmlFor="name" hint="ej. Steel Frame, Stone Plus">
              Nombre del sistema *
            </Label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={defaultValues?.name ?? ''}
              required
              placeholder="Ej. Steel Frame"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="marca_id"
                hint={isEdit ? 'no editable' : 'quién lo usa'}
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
            {isEdit && defaultValues?.slug && (
              <div>
                <Label htmlFor="slug" hint="no editable">
                  Slug
                </Label>
                <input
                  type="text"
                  id="slug"
                  value={defaultValues.slug}
                  disabled
                  className={`${inputClass} bg-neutral-100 text-neutral-500 cursor-not-allowed`}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            <strong>Compartido</strong>: lo administra ConstruirFácil, cualquier
            marca lo reutiliza (no recargar 20 veces). <strong>Propietario</strong>:
            sistema de marca; solo aparece en su catálogo y pisa al compartido
            del mismo slug. El catálogo matchea por slug contra el sistema
            constructivo de cada modelo.
          </p>
        </div>
      </fieldset>

      {/* ── Contenido público ─────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Contenido público
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="tagline" hint="frase corta destacada">
              Tagline
            </Label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              defaultValue={defaultValues?.tagline ?? ''}
              placeholder="Ej. Máxima velocidad, precisión robótica, 100% relocalizable"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="body" hint="descripción del sistema">
              Body
            </Label>
            <textarea
              id="body"
              name="body"
              defaultValue={defaultValues?.body ?? ''}
              rows={6}
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-neutral-400 mt-1">
              Si dejás el tagline vacío, el catálogo promueve la primera línea
              del body como tagline (compatibilidad con el formato anterior).
            </p>
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
