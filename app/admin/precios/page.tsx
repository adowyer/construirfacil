/**
 * app/admin/precios/page.tsx
 *
 * Precios por marca: (1) nombres + precio base (marca_price_slot) y
 * (2) import de precios por CSV. Pipeline permanente — así actualizamos
 * nosotros y cualquier cliente su DB. Spec: docs/cotizador-uber-spec.md.
 */

import { createClient } from '@/lib/supabase/server'
import {
  getMarcaPriceSlots,
  type MarcaPriceSlot,
} from '@/lib/supabase/queries/marca_price_slot'
import { CSV_HEADER } from '@/lib/pricing/price-import'
import { PreciosManager } from '@/components/admin/PreciosManager'

export default async function AdminPreciosPage() {
  const supabase = await createClient()
  const { data: marcas } = await supabase
    .from('marcas')
    .select('id, name')
    .order('name')

  const marcaList = (marcas ?? []) as { id: string; name: string }[]

  // Slots de todas las marcas (incl. deshabilitados) para el editor.
  const slotsByMarca: Record<string, MarcaPriceSlot[]> = {}
  await Promise.all(
    marcaList.map(async (m) => {
      slotsByMarca[m.id] = await getMarcaPriceSlots(supabase, m.id, {
        includeDisabled: true,
      })
    }),
  )

  return (
    <div className="max-w-4xl">
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Precios
        </h1>
        <p className="text-xs text-neutral-400 mt-2 max-w-2xl">
          Cada marca nombra sus precios y elige cuál es el base (el sugerido
          sobre el que el cotizador aplica los tramos). Los precios se cargan
          o actualizan por CSV.
        </p>
      </div>

      {marcaList.length === 0 ? (
        <p className="text-neutral-400 text-sm">No hay marcas.</p>
      ) : (
        <PreciosManager
          marcas={marcaList}
          slotsByMarca={slotsByMarca}
          csvHeader={CSV_HEADER.join(',')}
        />
      )}
    </div>
  )
}
