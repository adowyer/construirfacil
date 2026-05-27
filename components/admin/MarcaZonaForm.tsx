'use client'

/**
 * components/admin/MarcaZonaForm.tsx
 *
 * Form admin de una regla zonal (marca_zonas). En edit, el scope (provincia,
 * línea, sc) queda disabled — identifica la fila y cambiarlo rompería el UNIQUE.
 */

import { useActionState } from 'react'
import type { MarcaZonaRule } from '@/lib/content/zones'
import type { ProvinciaRow } from '@/lib/supabase/queries/zones'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  provincias: ProvinciaRow[]
  /** Líneas de la marca. NULL = aplica a todas. */
  lineas: { id: string; name: string }[]
  /** SCs usados por la marca en el catálogo (para autocompletar). NULL = todos. */
  scOptions: string[]
  defaultValues?: MarcaZonaRule | null
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

export function MarcaZonaForm({
  action,
  provincias,
  lineas,
  scOptions,
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

      {/* ── Scope (provincia + linea + sc) ────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Alcance
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="provincia_id" hint={isEdit ? 'no editable' : 'obligatorio'}>
              Provincia *
            </Label>
            <select
              id="provincia_id"
              name="provincia_id"
              defaultValue={defaultValues?.provincia_id ?? ''}
              required
              disabled={isEdit}
              className={`${inputClass} bg-white ${isEdit ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''}`}
            >
              <option value="" disabled>
                — elegí una —
              </option>
              {provincias.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="linea_id" hint={isEdit ? 'no editable' : 'null = todas'}>
              Línea
            </Label>
            <select
              id="linea_id"
              name="linea_id"
              defaultValue={defaultValues?.linea_id ?? 'null'}
              disabled={isEdit}
              className={`${inputClass} bg-white ${isEdit ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''}`}
            >
              <option value="null">Todas las líneas</option>
              {lineas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sistema_constructivo" hint={isEdit ? 'no editable' : 'null = todos'}>
              Sistema constructivo
            </Label>
            <select
              id="sistema_constructivo"
              name="sistema_constructivo"
              defaultValue={defaultValues?.sistema_constructivo ?? 'null'}
              disabled={isEdit}
              className={`${inputClass} bg-white ${isEdit ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''}`}
            >
              <option value="null">Todos los SCs</option>
              {scOptions.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Una regla por combinación (marca + provincia + línea + SC). La "regla
          general" (línea=todas y SC=todos) es la que admite cargo extra plano
          de transporte. Reglas más finas pueden bloquear o pinchar precio para
          un combo específico (ej. Tierra del Fuego solo Wood Plus).
        </p>
      </fieldset>

      {/* ── Disponibilidad ────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Disponibilidad
        </legend>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="excluded"
              defaultChecked={defaultValues?.excluded ?? false}
              className="mt-0.5"
            />
            <span className="text-sm">
              <strong>Zona excluida</strong> — la card aparece con badge
              "Consultar disponibilidad" (soft). No se cotiza en el sitio; se
              deriva a contacto.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="contact_only"
              defaultChecked={defaultValues?.contact_only ?? false}
              className="mt-0.5"
            />
            <span className="text-sm">
              <strong>Cotización personal</strong> — esconde el cotizador y
              muestra "Consultar precio". Se usa cuando el precio depende de
              transporte/condiciones específicas a discutir con el cliente.
            </span>
          </label>
        </div>
      </fieldset>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Pricing
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price_modifier_pct" hint="ej. 10 (+10%), -5 (-5%)">
              Modificador (%)
            </Label>
            <input
              type="number"
              id="price_modifier_pct"
              name="price_modifier_pct"
              defaultValue={defaultValues?.price_modifier_pct ?? ''}
              step="0.01"
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="extra_charge_amount" hint="USD · solo regla general">
              Cargo extra plano
            </Label>
            <input
              type="number"
              id="extra_charge_amount"
              name="extra_charge_amount"
              defaultValue={defaultValues?.extra_charge_amount ?? ''}
              step="0.01"
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="extra_charge_label" hint="admin · no se muestra al cliente">
            Descripción del cargo extra
          </Label>
          <input
            type="text"
            id="extra_charge_label"
            name="extra_charge_label"
            defaultValue={defaultValues?.extra_charge_label ?? ''}
            placeholder="Ej. Transporte Patagonia"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          El precio final visible se calcula como{' '}
          <code>precio_base × (1 + modificador) + cargo_extra</code>. Sin
          desglose: el cliente ve un único número.
        </p>
      </fieldset>

      {/* ── Marketing ─────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Promo + notas
        </legend>
        <div className="mb-4">
          <Label htmlFor="promo_label" hint="visible · texto del badge">
            Etiqueta promocional
          </Label>
          <input
            type="text"
            id="promo_label"
            name="promo_label"
            defaultValue={defaultValues?.promo_label ?? ''}
            placeholder="Ej. Envío bonificado, Promo verano"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="notes" hint="interno · no visible">
            Notas internas
          </Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={defaultValues?.notes ?? ''}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </fieldset>

      {/* ── Visibilidad ───────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Visibilidad
        </legend>
        <div>
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? 'active'}
            className={`${inputClass} bg-white`}
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
            <option value="archived">Archivada</option>
          </select>
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
