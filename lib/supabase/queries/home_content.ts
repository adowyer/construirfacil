/**
 * lib/supabase/queries/home_content.ts
 *
 * Contenido editable del HomeRow (slider inferior). Espejo de
 * header_content.ts: 5 slots canónicos (home-1..home-5), CF (b2c/b2b) y
 * per-marca, **B2B hereda B2C**, snapshot al guardar. Sin pinned.
 * Schema: supabase/migrations/0031_home_slide_content.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HomeVariant = 'b2c' | 'b2b'

export type HomeSlideKey =
  | 'home-1'
  | 'home-2'
  | 'home-3'
  | 'home-4'
  | 'home-5'

export const HOME_SLIDE_KEYS: HomeSlideKey[] = [
  'home-1',
  'home-2',
  'home-3',
  'home-4',
  'home-5',
]

export interface HomeSlide {
  id: string
  marca_id: string | null
  variant: HomeVariant | null
  slide_key: HomeSlideKey | 'banner'
  /** Nombre interno (solo admin/portal, no se renderiza). */
  admin_label: string | null
  eyebrow: string | null
  label: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  cta_style: 'primary' | 'ghost' | 'none' | null
  bg: string | null
  image_url: string | null
  text_color: string | null
  body_color: string | null
  narrow: boolean | null
  /**
   * Ancho del banner (slide_key='banner') — controla el aspect ratio del
   * slide en el HomeRow. Para los slots canónicos (home-1..home-5) este
   * valor se ignora (cada slot tiene su layout fijo).
   *  - 'wide'   → 672px (16/10, como Principal / Todo en Uno)
   *  - 'medium' → 336px (4/5, como las cards de financiación del header)
   *  - 'narrow' → 290px (como Lote + Casa)
   *  - 'text'   → 336px sin fondo, texto left-aligned
   */
  banner_width: 'wide' | 'medium' | 'narrow' | 'text' | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

export function isHomeKey(v: string): v is HomeSlideKey {
  return (HOME_SLIDE_KEYS as string[]).includes(v)
}

/**
 * Slides efectivos del HomeRow. marca → filas de esa marca. CF → todas las
 * filas CF (b2c+b2b) y resuelve por slot: fila del variant; si es b2b y no
 * hay, cae a b2c. Campos faltantes los completa HomeRow con home-defaults.
 */
export async function getResolvedHomeSlides(
  supabase: SupabaseClient,
  { marcaId, variant }: { marcaId: string | null; variant: HomeVariant },
): Promise<HomeSlide[]> {
  if (marcaId != null) {
    const { data, error } = await supabase
      .from('home_slide_content')
      .select('*')
      .eq('status', 'active')
      .eq('marca_id', marcaId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (error) {
      console.error('[getResolvedHomeSlides:marca]', error.message)
      return []
    }
    return (data ?? []) as HomeSlide[]
  }

  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .eq('status', 'active')
    .is('marca_id', null)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('[getResolvedHomeSlides:cf]', error.message)
    return []
  }

  const rows = (data ?? []) as HomeSlide[]
  const out: HomeSlide[] = []
  for (const key of HOME_SLIDE_KEYS) {
    const own = rows.find((r) => r.slide_key === key && r.variant === variant)
    const b2c = rows.find((r) => r.slide_key === key && r.variant === 'b2c')
    const chosen = own ?? (variant === 'b2b' ? b2c : undefined)
    if (chosen) out.push(chosen)
  }
  // Banners repetibles: del variant; si b2b sin propios, los de b2c.
  const ownBanners = rows.filter(
    (r) => r.slide_key === 'banner' && r.variant === variant,
  )
  const banners =
    ownBanners.length > 0
      ? ownBanners
      : variant === 'b2b'
        ? rows.filter((r) => r.slide_key === 'banner' && r.variant === 'b2c')
        : []
  out.push(...banners)
  return out
}

// ── Admin / portal ──────────────────────────────────────────────────────────

export async function getAllHomeSlidesCF(
  supabase: SupabaseClient,
): Promise<HomeSlide[]> {
  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .is('marca_id', null)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) {
    console.error('[getAllHomeSlidesCF]', error.message)
    return []
  }
  return (data ?? []) as HomeSlide[]
}

export async function getHomeSingletonCF(
  supabase: SupabaseClient,
  key: HomeSlideKey,
  variant: HomeVariant,
): Promise<HomeSlide | null> {
  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .is('marca_id', null)
    .eq('slide_key', key)
    .eq('variant', variant)
    .maybeSingle()
  if (error) {
    console.error('[getHomeSingletonCF]', error.message)
    return null
  }
  return (data as HomeSlide) ?? null
}

/** Fila de HomeRow por id (para editar un banner). */
export async function getHomeSlideById(
  supabase: SupabaseClient,
  id: string,
): Promise<HomeSlide | null> {
  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getHomeSlideById]', error.message)
    return null
  }
  return (data as HomeSlide) ?? null
}

export async function getMyHomeSlides(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<HomeSlide[]> {
  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .eq('marca_id', marcaId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) {
    console.error('[getMyHomeSlides]', error.message)
    return []
  }
  return (data ?? []) as HomeSlide[]
}

export async function getMyHomeSingleton(
  supabase: SupabaseClient,
  marcaId: string,
  key: HomeSlideKey,
): Promise<HomeSlide | null> {
  const { data, error } = await supabase
    .from('home_slide_content')
    .select('*')
    .eq('marca_id', marcaId)
    .eq('slide_key', key)
    .is('variant', null)
    .maybeSingle()
  if (error) {
    console.error('[getMyHomeSingleton]', error.message)
    return null
  }
  return (data as HomeSlide) ?? null
}
