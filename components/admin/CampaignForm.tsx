'use client'

/**
 * components/admin/CampaignForm.tsx
 *
 * Form de una campaña de medios. El `slug` es la llave canónica (path =
 * utm_content): si lo dejás vacío se deriva de la localidad. No lo cambies
 * después de repartir links — romperías la atribución.
 */

import { useActionState } from 'react'
import type { Campaign } from '@/lib/supabase/queries/campaigns'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  defaultValues?: Partial<Campaign> | null
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

const stampValue = (v: string | null | undefined): string =>
  (v ?? '').slice(0, 16)

export function CampaignForm({
  action,
  defaultValues,
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
        El banner aparece al tope del HomeRow en{' '}
        <code className="text-neutral-700">/casa-financiada/&lt;slug&gt;</code>.
        Sin campaña activa para ese slug, esa URL muestra el home normal.
      </div>

      {/* Identidad / URL */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Localidad y URL
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="localidad">Localidad</Label>
            <input
              type="text"
              id="localidad"
              name="localidad"
              required
              placeholder="San Patricio del Chañar"
              defaultValue={defaultValues?.localidad ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="provincia" hint="opcional">
              Provincia
            </Label>
            <input
              type="text"
              id="provincia"
              name="provincia"
              placeholder="Neuquén"
              defaultValue={defaultValues?.provincia ?? ''}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="slug" hint="vacío = se deriva de la localidad">
            Slug
          </Label>
          <input
            type="text"
            id="slug"
            name="slug"
            placeholder="san-patricio-del-chanar"
            defaultValue={defaultValues?.slug ?? ''}
            className={inputClass}
          />
          <p className="text-xs text-neutral-400 mt-1">
            Llave canónica (path y utm_content). No la cambies después de
            repartir los links del medio.
          </p>
        </div>
      </fieldset>

      {/* Copy del banner */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Copy del banner
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eyebrow" hint="línea chica arriba">
              Eyebrow
            </Label>
            <input
              type="text"
              id="eyebrow"
              name="eyebrow"
              placeholder="Financiación 100%"
              defaultValue={defaultValues?.eyebrow ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="headline" hint="título del banner">
              Título
            </Label>
            <input
              type="text"
              id="headline"
              name="headline"
              required
              placeholder="Accedé hoy a tu casa 100% financiada en San Patricio del Chañar"
              defaultValue={defaultValues?.headline ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="subheadline">Bajada</Label>
            <textarea
              id="subheadline"
              name="subheadline"
              rows={3}
              defaultValue={defaultValues?.subheadline ?? ''}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cta_label" hint="vacío = “Ver catálogo”">
                Texto del botón
              </Label>
              <input
                type="text"
                id="cta_label"
                name="cta_label"
                placeholder="Ver casas"
                defaultValue={defaultValues?.cta_label ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor="price_from" hint="opcional, texto libre">
                Precio desde
              </Label>
              <input
                type="text"
                id="price_from"
                name="price_from"
                placeholder="USD 45.000"
                defaultValue={defaultValues?.price_from ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="image_url" hint="opcional — foto de fondo del banner">
              URL de imagen
            </Label>
            <input
              type="text"
              id="image_url"
              name="image_url"
              placeholder="https://…"
              defaultValue={defaultValues?.image_url ?? ''}
              className={inputClass}
            />
            <p className="text-xs text-neutral-400 mt-1">
              Sin imagen, el banner usa el fondo oscuro editorial (on-brand).
            </p>
          </div>
        </div>
      </fieldset>

      {/* Vigencia */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Vigencia
        </legend>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaultValues?.active ?? true}
            className="h-4 w-4 accent-[#ff003d]"
          />
          Campaña activa
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="start_at" hint="opcional">
              Desde
            </Label>
            <input
              type="datetime-local"
              id="start_at"
              name="start_at"
              defaultValue={stampValue(defaultValues?.start_at)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="end_at" hint="opcional">
              Hasta
            </Label>
            <input
              type="datetime-local"
              id="end_at"
              name="end_at"
              defaultValue={stampValue(defaultValues?.end_at)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Fuera de la ventana (o inactiva), la URL cae al home normal — el
          tráfico pago nunca ve un 404.
        </p>
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
