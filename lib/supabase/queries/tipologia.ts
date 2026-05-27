/**
 * lib/supabase/queries/tipologia.ts
 *
 * Librería de tipologías arquitectónicas.
 *
 *   marca_id NULL  → COMPARTIDO (lo administra CF, cualquier marca lo usa).
 *   marca_id = X    → PROPIETARIO de esa marca.
 *
 * El catálogo resuelve por `code`: fila propietaria de la marca del modelo
 * pisa a la compartida. Si no hay ninguna, el catálogo cae al texto legacy
 * (`tipologia_code` raw) sin enriquecer.
 *
 * Schema: ver supabase/migrations/0046_tipologias_y_naming.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface TipologiaRow {
  id: string
  marca_id: string | null
  code: string
  nombre: string
  descripcion: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

/** Forma mínima que consume el catálogo público. */
export interface TipologiaLite {
  marca_id: string | null
  code: string
  nombre: string
  descripcion: string | null
  sort_order: number
}

/** Todas las filas, para el listado admin (incluye inactivas/archivadas). */
export async function getAllTipologias(
  supabase: SupabaseClient,
): Promise<TipologiaRow[]> {
  const { data, error } = await supabase
    .from('tipologia_catalog')
    .select('*')
    .order('marca_id', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })

  if (error) {
    console.error('[getAllTipologias]', error.message)
    return []
  }
  return (data ?? []) as TipologiaRow[]
}

/** Una fila por id (para la página de edición). */
export async function getTipologiaById(
  supabase: SupabaseClient,
  id: string,
): Promise<TipologiaRow | null> {
  const { data, error } = await supabase
    .from('tipologia_catalog')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getTipologiaById]', error.message)
    return null
  }
  return (data ?? null) as TipologiaRow | null
}

/**
 * Filas activas para el catálogo público (compartidas + de todas las marcas).
 * El consumidor resuelve, por la marca del modelo, propietario > compartido
 * por `code`, y ordena por sort_order.
 */
export async function getActiveTipologias(
  supabase: SupabaseClient,
): Promise<TipologiaLite[]> {
  const { data, error } = await supabase
    .from('tipologia_catalog')
    .select('marca_id, code, nombre, descripcion, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getActiveTipologias]', error.message)
    return []
  }
  return (data ?? []) as TipologiaLite[]
}
