/**
 * lib/supabase/queries/lineas.ts
 *
 * Queries for `lineas`. Una línea pertenece a una marca y agrupa modelos
 * (ej: BOSQUE / ATLAS / TERRA bajo HAUSIND).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface LineaRow {
  id: string
  marca_id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  hero_image_url: string | null
  icon_url: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  created_at: string
  updated_at: string
}

export interface LineaWithMarca extends LineaRow {
  marca: { id: string; name: string; slug: string } | null
}

export interface LineContentRow {
  id: string
  linea: string
  tipologia_code: string | null
  title: string | null
  subtitle: string | null
  body: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

/**
 * Trae todas las líneas (todas las marcas, todos los status). Usado por el
 * admin para alimentar dropdowns donde queremos ver inactivas también.
 */
export async function getAllLineas(
  supabase: SupabaseClient,
): Promise<LineaRow[]> {
  const { data, error } = await supabase
    .from('lineas')
    .select('*')
    .order('marca_id', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAllLineas]', error.message)
    return []
  }
  return (data ?? []) as LineaRow[]
}

/**
 * Trae las líneas activas de una marca puntual.
 */
export async function getLineasByMarca(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<LineaRow[]> {
  const { data, error } = await supabase
    .from('lineas')
    .select('*')
    .eq('marca_id', marcaId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getLineasByMarca]', error.message)
    return []
  }
  return (data ?? []) as LineaRow[]
}

/**
 * Trae todas las líneas con la marca joineada (para el listado admin).
 */
export async function getAllLineasWithMarca(
  supabase: SupabaseClient,
): Promise<LineaWithMarca[]> {
  const { data, error } = await supabase
    .from('lineas')
    .select('*, marca:marcas(id, name, slug)')
    .order('marca_id', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAllLineasWithMarca]', error.message)
    return []
  }
  return (data ?? []) as LineaWithMarca[]
}

/**
 * Trae una línea por ID con la marca joineada (para la página de edición).
 */
export async function getLineaById(
  supabase: SupabaseClient,
  id: string,
): Promise<LineaWithMarca | null> {
  const { data, error } = await supabase
    .from('lineas')
    .select('*, marca:marcas(id, name, slug)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getLineaById]', error.message)
    return null
  }
  return (data ?? null) as LineaWithMarca | null
}

/**
 * Trae el line_content (sin tipologia_code) que aplica a toda la línea.
 * Devuelve null si todavía no se creó.
 */
export async function getLineContentForLinea(
  supabase: SupabaseClient,
  lineaName: string,
): Promise<LineContentRow | null> {
  const { data, error } = await supabase
    .from('line_content')
    .select('*')
    .eq('linea', lineaName)
    .is('tipologia_code', null)
    .maybeSingle()

  if (error) {
    console.error('[getLineContentForLinea]', error.message)
    return null
  }
  return (data ?? null) as LineContentRow | null
}

/**
 * Trae las filas de `line_content` que tienen `tipologia_code` definido
 * (ej. 'estilos_intro', 'planos_intro'). Usado por el admin para exponer
 * editores secundarios además del editorial principal de la línea.
 */
export async function getLineContentTipologiasForLinea(
  supabase: SupabaseClient,
  lineaName: string,
): Promise<LineContentRow[]> {
  const { data, error } = await supabase
    .from('line_content')
    .select('*')
    .eq('linea', lineaName)
    .not('tipologia_code', 'is', null)
    .order('tipologia_code', { ascending: true })

  if (error) {
    console.error('[getLineContentTipologiasForLinea]', error.message)
    return []
  }
  return (data ?? []) as LineContentRow[]
}
