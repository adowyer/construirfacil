/**
 * lib/supabase/queries/delivery_conditions.ts
 *
 * "Condiciones de Entrega" — bloque HTML saneado que se muestra en una modal
 * desde la galería de exterior de cada modelo.
 *
 * Resolución: override de la marca (marca_id = X) ?? default de CF
 * (marca_id NULL). DEGRADA a null ante cualquier error (incluida tabla
 * inexistente si 0036 no se aplicó) → no se renderiza el pill (cero
 * regresión). Mismo espíritu que footer/header content.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface DeliveryConditionsRow {
  id: string
  marca_id: string | null
  body: string | null
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

/**
 * Contenido efectivo de "Condiciones de Entrega".
 * @param marcaId  null = solo el default de CF; con valor = override de esa marca ?? CF.
 */
export async function getDeliveryConditions(
  supabase: SupabaseClient,
  marcaId: string | null = null,
): Promise<DeliveryConditionsRow | null> {
  const { data, error } = await supabase
    .from('delivery_conditions_content')
    .select('*')
    .eq('status', 'active')
    .or(
      marcaId != null ? `marca_id.eq.${marcaId},marca_id.is.null` : 'marca_id.is.null',
    )

  if (error) {
    console.error('[getDeliveryConditions]', error.message)
    return null
  }

  const rows = (data ?? []) as DeliveryConditionsRow[]
  if (rows.length === 0) return null
  // Preferimos el override de la marca; si no, el global (marca_id NULL).
  return (
    rows.find((r) => marcaId != null && r.marca_id === marcaId) ??
    rows.find((r) => r.marca_id == null) ??
    null
  )
}

/** Para el admin CF: la fila global (marca_id NULL), cualquier status. */
export async function getDeliveryConditionsGlobal(
  supabase: SupabaseClient,
): Promise<DeliveryConditionsRow | null> {
  const { data, error } = await supabase
    .from('delivery_conditions_content')
    .select('*')
    .is('marca_id', null)
    .maybeSingle()

  if (error) {
    console.error('[getDeliveryConditionsGlobal]', error.message)
    return null
  }
  return (data as DeliveryConditionsRow) ?? null
}
