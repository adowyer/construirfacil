'use client'

/**
 * components/admin/FooterCardForm.tsx
 *
 * Form admin para crear/editar `footer_card_content`. Cada card pertenece
 * a una marca y arma una entrada del marquee inferior del catálogo.
 */

import { useActionState } from 'react'
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import type { Marca } from '@/types/database'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface FooterCardFormProps {
  action: ActionFn
  marcas: Pick<Marca, 'id' | 'name'>[]
  defaultValues?: FooterCardRow | null
  submitLabel?: string
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'ruler', label: 'Regla / m²' },
  { value: 'badge-check', label: 'Badge ✓ / Financiación' },
  { value: 'shield-check', label: 'Escudo / Garantía' },
  { value: 'factory', label: 'Fábrica' },
]

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

export function FooterCardForm({
  action,
  marcas,
  defaultValues,
  submitLabel = 'Guardar',
}: FooterCardFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-3xl">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <fieldset className="border border-[#E8E8E5] rounded-xl p-6 bg-white">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-500 px-2">
          Card del footer
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="marca_id">Marca</Label>
            <select
              id="marca_id"
              name="marca_id"
              defaultValue={defaultValues?.marca_id ?? ''}
              required
              className={`${inputClass} bg-white`}
            >
              <option value="">— elegí una marca —</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="sort_order" hint="(menor = primero)">
              Orden
            </Label>
            <input
              id="sort_order"
              name="sort_order"
              type="number"
              defaultValue={defaultValues?.sort_order ?? 100}
              className={inputClass}
            />
          </div>

          <div>
            <Label htmlFor="icon_key">Ícono</Label>
            <select
              id="icon_key"
              name="icon_key"
              defaultValue={defaultValues?.icon_key ?? 'factory'}
              className={`${inputClass} bg-white`}
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

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
            <Label htmlFor="number_text" hint='ej. "50.000", "100%", "Garantía"'>
              Texto destacado
            </Label>
            <input
              id="number_text"
              name="number_text"
              type="text"
              required
              defaultValue={defaultValues?.number_text ?? ''}
              className={inputClass}
            />
          </div>

          <div>
            <Label htmlFor="unit_text" hint='ej. "m²" — opcional'>
              Unidad
            </Label>
            <input
              id="unit_text"
              name="unit_text"
              type="text"
              defaultValue={defaultValues?.unit_text ?? ''}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="label_text" hint="texto chico debajo del destacado">
              Label
            </Label>
            <input
              id="label_text"
              name="label_text"
              type="text"
              required
              defaultValue={defaultValues?.label_text ?? ''}
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
