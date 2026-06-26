/**
 * lib/supabase/queries/tipologia-attrs.ts
 *
 * Librería de los 4 ejes de tipología nueva (post-0090):
 *   circulacion · morfologia · acceso · area_social
 *
 *   marca_id NULL → COMPARTIDO (lo administra CF, cualquier marca lo usa)
 *   marca_id = X  → PROPIETARIO de esa marca (override o exclusivo)
 *
 * Schema: ver supabase/migrations/0090_house_catalog_4_ejes.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AttrEje = 'circulacion' | 'morfologia' | 'acceso' | 'area_social'

export const ATTR_EJES: AttrEje[] = ['circulacion', 'morfologia', 'acceso', 'area_social']

export const ATTR_EJE_LABEL: Record<AttrEje, string> = {
  circulacion: 'Circulación',
  morfologia: 'Morfología',
  acceso: 'Acceso',
  area_social: 'Área Social',
}

export const ATTR_EJE_HINT: Record<AttrEje, string> = {
  circulacion: 'Cómo se mueve. Valores: EJES · NODO.',
  morfologia: 'La forma. Valores: DECK · CUBO · ZETA.',
  acceso: 'Por dónde entrás. Valores: Frontal · Lateral · Flip.',
  area_social: 'Dónde está el living. Valores: Anterior · Posterior · Lateral.',
}

export interface TipologiaAttrRow {
  id: string
  marca_id: string | null
  eje: AttrEje
  valor: string
  nombre: string
  descripcion: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

export async function getAllTipologiaAttrs(
  supabase: SupabaseClient,
): Promise<TipologiaAttrRow[]> {
  const { data, error } = await supabase
    .from('tipologia_attrs')
    .select('*')
    .order('eje', { ascending: true })
    .order('marca_id', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('valor', { ascending: true })
  if (error) {
    console.error('[getAllTipologiaAttrs]', error.message)
    return []
  }
  return (data ?? []) as TipologiaAttrRow[]
}

export async function getTipologiaAttrById(
  supabase: SupabaseClient,
  id: string,
): Promise<TipologiaAttrRow | null> {
  const { data, error } = await supabase
    .from('tipologia_attrs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getTipologiaAttrById]', error.message)
    return null
  }
  return (data ?? null) as TipologiaAttrRow | null
}

export function isValidEje(s: string | null | undefined): s is AttrEje {
  return s === 'circulacion' || s === 'morfologia' || s === 'acceso' || s === 'area_social'
}
