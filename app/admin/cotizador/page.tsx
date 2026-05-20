/**
 * app/admin/cotizador/page.tsx
 * Admin del cotizador "Uber": edita los 3 tramos + T.C. de referencia +
 * caveat. Spec: docs/cotizador-uber-spec.md.
 */

import { createClient } from '@/lib/supabase/server'
import {
  getAllPricingTiers,
  getPricingConfig,
} from '@/lib/supabase/queries/pricing_tiers'
import { CotizadorForm } from '@/components/admin/CotizadorForm'

export default async function AdminCotizadorPage() {
  const supabase = await createClient()
  const [tiers, config] = await Promise.all([
    getAllPricingTiers(supabase),
    getPricingConfig(supabase),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Cotizador
        </h1>
        <p className="text-xs text-neutral-400 mt-2 max-w-xl">
          El selector precio-vs-tiempo. El tramo elige el precio total; la
          cuota se deriva con los datos de los bancos (misma fuente que
          Ximia). El precio base es el de lista de cada modelo.
        </p>
      </div>

      {tiers.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          No hay tramos. Aplicá la migración <code>0040_pricing_tiers.sql</code>{' '}
          (crea los 3 tramos y la config).
        </p>
      ) : (
        <CotizadorForm tiers={tiers} config={config} />
      )}
    </div>
  )
}
