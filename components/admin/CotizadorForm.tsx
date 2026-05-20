'use client'

/**
 * components/admin/CotizadorForm.tsx
 *
 * Edita los 3 tramos del cotizador + la config (T.C. de referencia +
 * caveat). Una sola página, un solo submit (son pocos campos fijos).
 */

import { useActionState } from 'react'
import { saveCotizador } from '@/app/admin/cotizador/actions'
import type {
  PricingTier,
  PricingConfig,
} from '@/lib/supabase/queries/pricing_tiers'
import { RichTextEditor } from '@/components/admin/RichTextEditor'

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'
const lbl =
  'block text-[11px] uppercase tracking-widest text-neutral-400 mb-1'

export function CotizadorForm({
  tiers,
  config,
}: {
  tiers: PricingTier[]
  config: PricingConfig | null
}) {
  const [state, formAction, isPending] = useActionState(saveCotizador, {
    error: null,
  })

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="tier_ids"
        value={tiers.map((t) => t.id).join(',')}
      />

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}
      {state.ok && !state.error && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
          Guardado.
        </div>
      )}

      {/* Tramos */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Tramos (precio vs. tiempo)
        </legend>
        <div className="space-y-6">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="border border-neutral-200 rounded-lg p-4"
            >
              <p className="text-xs text-neutral-400 mb-3 font-mono">
                {t.key}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lbl} htmlFor={`label__${t.id}`}>
                    Nombre
                  </label>
                  <input
                    id={`label__${t.id}`}
                    name={`label__${t.id}`}
                    defaultValue={t.label}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={lbl} htmlFor={`lead__${t.id}`}>
                    Plazo (texto)
                  </label>
                  <input
                    id={`lead__${t.id}`}
                    name={`lead__${t.id}`}
                    defaultValue={t.lead_time_label ?? ''}
                    placeholder="6 meses"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={lbl} htmlFor={`mod__${t.id}`}>
                    Δ precio %{' '}
                    <span className="text-neutral-300 normal-case">
                      (+caro / −barato)
                    </span>
                  </label>
                  <input
                    id={`mod__${t.id}`}
                    name={`mod__${t.id}`}
                    type="number"
                    step="0.1"
                    defaultValue={t.price_modifier_pct}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 mt-3">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    name={`hl__${t.id}`}
                    defaultChecked={t.highlighted}
                    className="h-4 w-4 accent-[#ff003d]"
                  />
                  Destacado
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    name={`active__${t.id}`}
                    defaultChecked={t.active}
                    className="h-4 w-4 accent-[#ff003d]"
                  />
                  Activo
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Config */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Cuota — T.C. de referencia y aviso
        </legend>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-lg mb-4">
          Sin T.C. cargado, la cuota <strong>no se muestra</strong> en el
          sitio (a propósito: nunca un número falso). Cargá el valor real
          para activarla.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl} htmlFor="usd_ars_ref">
              T.C. USD→ARS de referencia
            </label>
            <input
              id="usd_ars_ref"
              name="usd_ars_ref"
              type="number"
              step="0.01"
              defaultValue={config?.usd_ars_ref ?? ''}
              placeholder="(vacío = cuota oculta)"
              className={inputClass}
            />
          </div>
          <div>
            <label className={lbl} htmlFor="fx_ref_date">
              Fecha del T.C.
            </label>
            <input
              id="fx_ref_date"
              name="fx_ref_date"
              type="date"
              defaultValue={config?.fx_ref_date ?? ''}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={lbl} htmlFor="caveat_html">
            Aviso legal / letra chica
          </label>
          <RichTextEditor name="caveat_html" initialHTML={config?.caveat_html ?? ''} />
          <p className="text-xs text-neutral-400 mt-1">
            UVA / estimado / sujeto a precalificación. Se sanea al guardar.
          </p>
        </div>
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
