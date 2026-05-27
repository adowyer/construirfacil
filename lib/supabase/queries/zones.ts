/**
 * lib/supabase/queries/zones.ts
 *
 * Queries de provincias + reglas zonales (marca_zonas).
 * Schema: ver supabase/migrations/0047_ubicacion.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MarcaZonaRule } from '@/lib/content/zones'

export interface ProvinciaRow {
  id: string
  slug: string
  name: string
  sort_order: number
}

/** Todas las provincias ordenadas (lista fija). */
export async function getAllProvincias(
  supabase: SupabaseClient,
): Promise<ProvinciaRow[]> {
  const { data, error } = await supabase
    .from('provincias')
    .select('id, slug, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAllProvincias]', error.message)
    return []
  }
  return (data ?? []) as ProvinciaRow[]
}

/** Todas las reglas zonales activas (para resolución en el catálogo). */
export async function getActiveMarcaZonas(
  supabase: SupabaseClient,
): Promise<MarcaZonaRule[]> {
  const { data, error } = await supabase
    .from('marca_zonas')
    .select(
      'id, marca_id, provincia_id, linea_id, sistema_constructivo, excluded, price_modifier_pct, extra_charge_amount, extra_charge_label, contact_only, promo_label, notes, status',
    )
    .eq('status', 'active')

  if (error) {
    console.error('[getActiveMarcaZonas]', error.message)
    return []
  }
  return (data ?? []) as MarcaZonaRule[]
}

/** Todas las reglas de una marca (admin: incluye inactivas). */
export async function getMarcaZonasByMarca(
  supabase: SupabaseClient,
  marca_id: string,
): Promise<MarcaZonaRule[]> {
  const { data, error } = await supabase
    .from('marca_zonas')
    .select(
      'id, marca_id, provincia_id, linea_id, sistema_constructivo, excluded, price_modifier_pct, extra_charge_amount, extra_charge_label, contact_only, promo_label, notes, status',
    )
    .eq('marca_id', marca_id)

  if (error) {
    console.error('[getMarcaZonasByMarca]', error.message)
    return []
  }
  return (data ?? []) as MarcaZonaRule[]
}

/** Una fila por id (admin edit). */
export async function getMarcaZonaById(
  supabase: SupabaseClient,
  id: string,
): Promise<MarcaZonaRule | null> {
  const { data, error } = await supabase
    .from('marca_zonas')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getMarcaZonaById]', error.message)
    return null
  }
  return (data ?? null) as MarcaZonaRule | null
}
