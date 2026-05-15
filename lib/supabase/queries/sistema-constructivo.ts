/**
 * lib/supabase/queries/sistema-constructivo.ts
 *
 * Librería de sistemas constructivos.
 *
 *   marca_id NULL  → COMPARTIDO (lo administra CF, cualquier marca lo usa).
 *   marca_id = X    → PROPIETARIO de esa marca.
 *
 * El catálogo resuelve por `slug`: fila propietaria de la marca del modelo
 * pisa a la compartida. Si no hay ninguna, el panel cae al texto legacy
 * (brand_content + títulos hardcodeados).
 *
 * Schema: ver supabase/migrations/0019_sistema_constructivo_content.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SistemaConstructivoRow {
  id: string
  marca_id: string | null
  slug: string
  name: string
  tagline: string | null
  body: string | null
  hero_image_url: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

/** Forma mínima que consume el catálogo público (panel SC). */
export interface SistemaConstructivoLite {
  marca_id: string | null
  slug: string
  name: string
  tagline: string | null
  body: string | null
  hero_image_url: string | null
  sort_order: number
}

/** Todas las filas, para el listado admin (incluye inactivas/archivadas). */
export async function getAllSistemaConstructivo(
  supabase: SupabaseClient,
): Promise<SistemaConstructivoRow[]> {
  const { data, error } = await supabase
    .from('sistema_constructivo_content')
    .select('*')
    .order('marca_id', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[getAllSistemaConstructivo]', error.message)
    return []
  }
  return (data ?? []) as SistemaConstructivoRow[]
}

/** Una fila por id (para la página de edición). */
export async function getSistemaConstructivoById(
  supabase: SupabaseClient,
  id: string,
): Promise<SistemaConstructivoRow | null> {
  const { data, error } = await supabase
    .from('sistema_constructivo_content')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getSistemaConstructivoById]', error.message)
    return null
  }
  return (data ?? null) as SistemaConstructivoRow | null
}

/**
 * Filas activas para el catálogo público (compartidas + de todas las marcas).
 * El panel resuelve, por la marca del modelo, propietario > compartido por
 * slug, y ordena por sort_order.
 */
export async function getActiveSistemaConstructivo(
  supabase: SupabaseClient,
): Promise<SistemaConstructivoLite[]> {
  const { data, error } = await supabase
    .from('sistema_constructivo_content')
    .select('marca_id, slug, name, tagline, body, hero_image_url, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getActiveSistemaConstructivo]', error.message)
    return []
  }
  return (data ?? []) as SistemaConstructivoLite[]
}
