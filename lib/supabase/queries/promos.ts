/**
 * lib/supabase/queries/promos.ts
 *
 * Carga banners promocionales del catálogo público (tabla `promo_messages`).
 * Se renderizan con CatalogPromoBanner — el founder los edita desde
 * /admin/promos.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type PromoColor = 'red' | 'cyan' | 'yellow' | 'green'
export type PromoScope = 'hero' | 'intermediate'
export type PromoCtaAction = 'none' | 'contactar' | 'ximia' | 'saber_mas'

export interface PromoMessage {
  id: string
  marca_id: string
  provincia_id: string | null
  scope: PromoScope
  titulo: string
  cuerpo: string
  color: PromoColor
  cta_label: string | null
  cta_action: PromoCtaAction
  activo: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}

/**
 * Trae todos los banners activos de una marca (todos los scopes y todas
 * las provincias). El componente que renderiza filtra por provincia
 * efectiva en cliente, así un cambio de provincia no requiere refetch.
 */
export async function getPromoMessagesForMarca(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<PromoMessage[]> {
  const { data, error } = await supabase
    .from('promo_messages')
    .select(
      'id, marca_id, provincia_id, scope, titulo, cuerpo, color, cta_label, cta_action, activo, sort_order, starts_at, ends_at',
    )
    .eq('marca_id', marcaId)
    .eq('activo', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getPromoMessagesForMarca]', error.message)
    return []
  }
  return (data ?? []) as PromoMessage[]
}

/**
 * Filtra los banners por provincia efectiva:
 *   - provincia_id IS NULL  → aplica siempre (todas las provincias)
 *   - provincia_id IS NOT NULL → solo si el usuario eligió esa provincia
 *
 * Si el banner tiene starts_at / ends_at, se respeta la ventana temporal.
 */
export function filterPromosForProvincia(
  promos: PromoMessage[],
  provinciaId: string | null,
  now: Date = new Date(),
): PromoMessage[] {
  const nowIso = now.toISOString()
  return promos.filter((p) => {
    if (p.provincia_id && p.provincia_id !== provinciaId) return false
    if (p.starts_at && nowIso < p.starts_at) return false
    if (p.ends_at && nowIso > p.ends_at) return false
    return true
  })
}
