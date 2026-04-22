'use client'

/**
 * components/admin/ModelForm.tsx
 *
 * Shared form component for create and edit house_catalog entries.
 * Handles presale price live computation client-side.
 * Works with useFormState / useActionState to surface Server Action errors.
 */

import { useActionState, useState, useEffect } from 'react'
import type { HouseCatalogRow } from '@/lib/supabase/queries/models'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface ModelFormProps {
  action: ActionFn
  defaultValues?: Partial<HouseCatalogRow>
  submitLabel?: string
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
    </label>
  )
}

function TextInput({
  id,
  name,
  defaultValue,
  required,
  placeholder,
}: {
  id: string
  name: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      required={required}
      placeholder={placeholder}
      className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
    />
  )
}

function NumberInput({
  id,
  name,
  defaultValue,
  step,
  min,
  onChange,
}: {
  id: string
  name: string
  defaultValue?: number | null
  step?: string
  min?: string
  onChange?: (value: string) => void
}) {
  return (
    <input
      type="number"
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      step={step ?? 'any'}
      min={min ?? '0'}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
    />
  )
}

const CONSTRUCTION_SYSTEMS = ['HAUSIND', 'STEEL FRAME', 'WOOD FRAME', 'MAMPOSTERIA'] as const

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function ModelForm({ action, defaultValues, submitLabel = 'Guardar' }: ModelFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  // Live presale price
  const [publicPrice, setPublicPrice] = useState<string>(
    defaultValues?.public_price_usd != null
      ? String(defaultValues.public_price_usd)
      : '',
  )
  const [discountPct, setDiscountPct] = useState<string>(
    defaultValues?.presale_discount_pct != null
      ? String(defaultValues.presale_discount_pct)
      : '',
  )
  const [presalePrice, setPresalePrice] = useState<string>('')

  useEffect(() => {
    const price = parseFloat(publicPrice)
    const discount = parseFloat(discountPct)
    if (!isNaN(price) && !isNaN(discount) && discount >= 0 && discount <= 100) {
      const computed = price * (1 - discount / 100)
      setPresalePrice(
        computed.toLocaleString('es-AR', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      )
    } else {
      setPresalePrice('')
    }
  }, [publicPrice, discountPct])

  return (
    <form action={formAction} className="space-y-8">
      {/* Error banner */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      {/* Section: Identity */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Identificación
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="model_id">Model ID *</Label>
            <TextInput
              id="model_id"
              name="model_id"
              defaultValue={defaultValues?.model_id}
              required
              placeholder="ej. TIMBO"
            />
          </div>
          <div>
            <Label htmlFor="variant_code">Variant Code * (único)</Label>
            <TextInput
              id="variant_code"
              name="variant_code"
              defaultValue={defaultValues?.variant_code}
              required
              placeholder="ej. TIMBO-2-A"
            />
          </div>
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <TextInput
              id="name"
              name="name"
              defaultValue={defaultValues?.name}
              required
              placeholder="ej. Timbo 2 Dormitorios"
            />
          </div>
        </div>
      </fieldset>

      {/* Section: Characteristics */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Características
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="variant_style">Estilo de variante</Label>
            <TextInput
              id="variant_style"
              name="variant_style"
              defaultValue={defaultValues?.variant_style}
              placeholder="ej. Moderno"
            />
          </div>
          <div>
            <Label htmlFor="recommended_use">Uso recomendado</Label>
            <TextInput
              id="recommended_use"
              name="recommended_use"
              defaultValue={defaultValues?.recommended_use}
              placeholder="ej. Vivienda familiar"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="area_m2">Superficie (m²)</Label>
            <NumberInput id="area_m2" name="area_m2" defaultValue={defaultValues?.area_m2} step="0.01" />
          </div>
          <div>
            <Label htmlFor="floors">Pisos</Label>
            <NumberInput id="floors" name="floors" defaultValue={defaultValues?.floors} step="1" />
          </div>
          <div>
            <Label htmlFor="min_bedrooms">Dorm. mín.</Label>
            <NumberInput id="min_bedrooms" name="min_bedrooms" defaultValue={defaultValues?.min_bedrooms} step="1" />
          </div>
          <div>
            <Label htmlFor="max_bedrooms">Dorm. máx.</Label>
            <NumberInput id="max_bedrooms" name="max_bedrooms" defaultValue={defaultValues?.max_bedrooms} step="1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="recommended_family_size_min">Familia mín. (personas)</Label>
            <NumberInput
              id="recommended_family_size_min"
              name="recommended_family_size_min"
              defaultValue={defaultValues?.recommended_family_size_min}
              step="1"
            />
          </div>
          <div>
            <Label htmlFor="recommended_family_size_max">Familia máx. (personas)</Label>
            <NumberInput
              id="recommended_family_size_max"
              name="recommended_family_size_max"
              defaultValue={defaultValues?.recommended_family_size_max}
              step="1"
            />
          </div>
        </div>
      </fieldset>

      {/* Section: Construction */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Sistema constructivo
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="construction_system">Sistema</Label>
            <select
              id="construction_system"
              name="construction_system"
              defaultValue={defaultValues?.construction_system ?? 'HAUSIND'}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white"
            >
              {CONSTRUCTION_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="brochure_url">URL del brochure</Label>
            <TextInput
              id="brochure_url"
              name="brochure_url"
              defaultValue={defaultValues?.brochure_url}
              placeholder="https://..."
            />
          </div>
        </div>
      </fieldset>

      {/* Section: Pricing */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Precios
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="construction_cost_usd">Costo de construcción (USD)</Label>
            <NumberInput
              id="construction_cost_usd"
              name="construction_cost_usd"
              defaultValue={defaultValues?.construction_cost_usd}
              step="0.01"
            />
          </div>
          <div>
            <Label htmlFor="public_price_usd">Precio público (USD)</Label>
            <NumberInput
              id="public_price_usd"
              name="public_price_usd"
              defaultValue={defaultValues?.public_price_usd}
              step="0.01"
              onChange={setPublicPrice}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="construction_cost_pct">% costo de construcción</Label>
            <NumberInput
              id="construction_cost_pct"
              name="construction_cost_pct"
              defaultValue={defaultValues?.construction_cost_pct}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="presale_discount_pct">% descuento preventa</Label>
            <NumberInput
              id="presale_discount_pct"
              name="presale_discount_pct"
              defaultValue={defaultValues?.presale_discount_pct}
              step="0.01"
              min="0"
              onChange={setDiscountPct}
            />
          </div>
        </div>

        {/* Live presale price */}
        {presalePrice && (
          <div className="bg-[#F7F7F5] border border-[#E8E8E5] rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-widest text-neutral-400">
              Precio preventa calculado
            </span>
            <span className="text-lg font-black text-black">{presalePrice}</span>
            {discountPct && (
              <span className="text-xs text-neutral-400">({discountPct}% dto.)</span>
            )}
          </div>
        )}
      </fieldset>

      {/* Section: Status */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Estado
        </legend>
        <div className="w-48">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? 'active'}
            className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-black text-white px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
