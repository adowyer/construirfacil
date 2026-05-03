/**
 * lib/supabase/queries/brand-content.ts
 *
 * Queries for `brand_content` (textos globales de marca: concept, system_wood,
 * system_steel, system_concrete, brand_values, …). Consumido por el catálogo
 * público (HeroSlider, sliders educativos).
 *
 * Schema (ver supabase/migrations/0005_content_tables.sql):
 *   id uuid pk, key text unique, label text not null,
 *   title, subtitle, body, cta_label, cta_url,
 *   sort_order int, status (active/inactive/archived), updated_at
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BrandContentRow {
  id: string
  key: string
  label: string
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

/** Trae todos los brand_content para el listado admin. */
export async function getAllBrandContent(
  supabase: SupabaseClient,
): Promise<BrandContentRow[]> {
  const { data, error } = await supabase
    .from('brand_content')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('key', { ascending: true })

  if (error) {
    console.error('[getAllBrandContent]', error.message)
    return []
  }
  return (data ?? []) as BrandContentRow[]
}

/** Trae un brand_content por id. */
export async function getBrandContentById(
  supabase: SupabaseClient,
  id: string,
): Promise<BrandContentRow | null> {
  const { data, error } = await supabase
    .from('brand_content')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getBrandContentById]', error.message)
    return null
  }
  return (data ?? null) as BrandContentRow | null
}
