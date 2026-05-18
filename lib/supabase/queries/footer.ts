/**
 * lib/supabase/queries/footer.ts
 *
 * Queries para `footer_card_content` — cards del footer del catálogo
 * editables por marca.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type FooterCardRow = {
  id: string
  marca_id: string
  sort_order: number
  icon_key: string
  number_text: string
  unit_text: string | null
  label_text: string
  status: string
  created_at: string
  updated_at: string
}

export async function getFooterCardsForMarca(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<FooterCardRow[]> {
  const { data, error } = await supabase
    .from('footer_card_content')
    .select('*')
    .eq('marca_id', marcaId)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getFooterCardsForMarca]', error.message)
    return []
  }
  return (data ?? []) as FooterCardRow[]
}

/** Todas las cards de la marca (cualquier status) — para el portal. */
export async function getFooterCardsForMarcaAll(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<FooterCardRow[]> {
  const { data, error } = await supabase
    .from('footer_card_content')
    .select('*')
    .eq('marca_id', marcaId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getFooterCardsForMarcaAll]', error.message)
    return []
  }
  return (data ?? []) as FooterCardRow[]
}

export async function getAllFooterCardsForAdmin(
  supabase: SupabaseClient,
): Promise<(FooterCardRow & { marca_name: string })[]> {
  const { data, error } = await supabase
    .from('footer_card_content')
    .select('*, marcas:marca_id(name)')
    .order('marca_id')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAllFooterCardsForAdmin]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    ...(r as FooterCardRow),
    marca_name: (r as { marcas: { name: string } | null }).marcas?.name ?? '',
  }))
}

export async function getFooterCardById(
  supabase: SupabaseClient,
  id: string,
): Promise<FooterCardRow | null> {
  const { data, error } = await supabase
    .from('footer_card_content')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getFooterCardById]', error.message)
    return null
  }
  return (data as FooterCardRow) ?? null
}

// ---------------------------------------------------------------------------
// footer_content — cierre + institucional (singleton CF, key='cf').
// ---------------------------------------------------------------------------

export type FooterContentRow = {
  id: string
  key: string
  eyebrow: string | null
  title: string | null
  cta_primary_label: string | null
  cta_secondary_label: string | null
  copyright_text: string | null
  privacy_label: string | null
  privacy_url: string | null
  terms_label: string | null
  terms_url: string | null
}

/**
 * Singleton del cierre/institucional. null si no existe (tabla sin aplicar /
 * sin fila) → CatalogFooter usa el hardcoded. Cero regresión.
 */
export async function getFooterContent(
  supabase: SupabaseClient,
): Promise<FooterContentRow | null> {
  const { data, error } = await supabase
    .from('footer_content')
    .select('*')
    .eq('key', 'cf')
    .maybeSingle()

  if (error) {
    console.error('[getFooterContent]', error.message)
    return null
  }
  return (data as FooterContentRow) ?? null
}
