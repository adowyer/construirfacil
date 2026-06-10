/**
 * lib/supabase/queries/header_content.ts
 *
 * Resolución del contenido editable del header (slider HeroRow), 3 versiones.
 *
 * Modelo (ver supabase/migrations/0027_header_slide_content.sql):
 *   - CF B2C  : filas marca_id NULL, variant 'b2c'  (ruta /)
 *   - CF B2B  : filas marca_id NULL, variant 'b2b'  (ruta /empresas)
 *   - Marca X : filas marca_id = X                  (/catalogo/{slug})
 *   - is_cf_pinned: slides pasos/principal presentes en TODAS las versiones.
 *
 * Resolución a nivel página:
 *   - marcaId = null  → versión CF según `variant` (pinned ∪ filas de ese variant)
 *   - marcaId = X     → versión de la marca (pinned ∪ filas de la marca)
 *
 * DEGRADA a [] ante cualquier error (incluida tabla inexistente si la
 * migración 0027 aún no se aplicó) → HeroRow usa su hardcoded = cero
 * regresión. Mismo espíritu que content_resolve.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HeaderVariant = 'b2c' | 'b2b'

export type HeaderSlideKind =
  | 'pasos'
  | 'principal'
  | 'crece'
  | 'flex'
  | 'lineas-intro'
  | 'linea-card'
  | 'banner'

export interface HeaderSlide {
  id: string
  marca_id: string | null
  variant: HeaderVariant | null
  is_cf_pinned: boolean
  slide_kind: HeaderSlideKind
  /** Nombre interno (solo admin/portal, no se renderiza). */
  admin_label: string | null
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  image_url: string | null
  /** Iso de la columna de color (crece/flex). Distinto de image_url (fondo). */
  panel_image_url: string | null
  long_body: string | null
  /** Banner: color de fondo (modo Color) y tamaño chico (narrow). */
  bg: string | null
  narrow: boolean | null
  gallery_urls: string[]
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  /** Porción del `title` que debe renderizar en bold. Solo lo usa el slide
   *  `principal` (typewriter) — útil para resaltar el nombre de la localidad
   *  en una landing de campaña. No es columna en DB; lo setea el código que
   *  construye el slide sintético (ver `campaignPrincipalSlide`). */
  bold_term?: string | null
}

/**
 * Slides efectivos del header para la página.
 *
 * @param marcaId  null = versión CF (usa `variant`); con valor = versión de esa marca.
 * @param variant  'b2c' (/) | 'b2b' (/empresas). Solo aplica si marcaId == null.
 */
export async function getResolvedHeaderSlides(
  supabase: SupabaseClient,
  { marcaId, variant }: { marcaId: string | null; variant: HeaderVariant },
): Promise<HeaderSlide[]> {
  // Marca: pinned ∪ filas de esa marca (sin herencia de CF). `.or` simple
  // (nada de `and()` anidado — no resuelve en este PostgREST).
  if (marcaId != null) {
    const { data, error } = await supabase
      .from('header_slide_content')
      .select('*')
      .eq('status', 'active')
      .or(`is_cf_pinned.is.true,marca_id.eq.${marcaId}`)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (error) {
      console.error('[getResolvedHeaderSlides:marca]', error.message)
      return []
    }
    return (data ?? []) as HeaderSlide[]
  }

  // CF: traemos TODAS las filas CF (marca_id NULL = pinned + b2c + b2b) y
  // resolvemos en JS. **B2B HEREDA B2C**: por slide, fila del variant; si es
  // b2b y no hay, cae a b2c. B2C ignora b2b. Snapshot: si existe fila propia
  // del variant se usa esa entera (no hay merge por campo).
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .eq('status', 'active')
    .is('marca_id', null)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('[getResolvedHeaderSlides:cf]', error.message)
    return []
  }

  return resolveCfByVariant((data ?? []) as HeaderSlide[], variant)
}

// ---------------------------------------------------------------------------
// Admin (CF) — todas las filas CF (marca_id NULL), sin resolver.
// ---------------------------------------------------------------------------

export const HEADER_SINGLETON_KINDS: HeaderSlideKind[] = [
  'pasos',
  'principal',
  'crece',
  'flex',
  'lineas-intro',
]
export const HEADER_PINNED_KINDS: HeaderSlideKind[] = ['pasos', 'principal']

/**
 * Resuelve las filas CF para una versión. Pinned siempre. Singletons:
 * fila del variant; si es b2b y no hay, cae a b2c (B2C ignora b2b).
 * linea-card: las del variant; si es b2b y no tiene propias, las de b2c.
 * Conserva el orden de entrada (ya viene por sort_order, id).
 */
function resolveCfByVariant(
  rows: HeaderSlide[],
  variant: HeaderVariant,
): HeaderSlide[] {
  const out: HeaderSlide[] = []

  // Pinned (en su orden de entrada).
  for (const r of rows) if (r.is_cf_pinned) out.push(r)

  const single = (kind: HeaderSlideKind, v: HeaderVariant) =>
    rows.find(
      (r) =>
        !r.is_cf_pinned && r.slide_kind === kind && r.variant === v,
    )

  for (const kind of HEADER_SINGLETON_KINDS) {
    if (HEADER_PINNED_KINDS.includes(kind)) continue // pinned ya agregados
    const chosen =
      single(kind, variant) ??
      (variant === 'b2b' ? single(kind, 'b2c') : undefined)
    if (chosen) out.push(chosen)
  }

  const ownCards = rows.filter(
    (r) =>
      !r.is_cf_pinned &&
      r.slide_kind === 'linea-card' &&
      r.variant === variant,
  )
  const cards =
    ownCards.length > 0
      ? ownCards
      : variant === 'b2b'
        ? rows.filter(
            (r) =>
              !r.is_cf_pinned &&
              r.slide_kind === 'linea-card' &&
              r.variant === 'b2c',
          )
        : []
  out.push(...cards)

  // Banners repetibles: misma lógica que linea-card (b2b hereda b2c).
  const ownBanners = rows.filter(
    (r) =>
      !r.is_cf_pinned &&
      r.slide_kind === 'banner' &&
      r.variant === variant,
  )
  const banners =
    ownBanners.length > 0
      ? ownBanners
      : variant === 'b2b'
        ? rows.filter(
            (r) =>
              !r.is_cf_pinned &&
              r.slide_kind === 'banner' &&
              r.variant === 'b2c',
          )
        : []
  out.push(...banners)

  return out
}

export function isHeaderKind(v: string): v is HeaderSlideKind {
  return (
    v === 'pasos' ||
    v === 'principal' ||
    v === 'crece' ||
    v === 'flex' ||
    v === 'lineas-intro' ||
    v === 'linea-card' ||
    v === 'banner'
  )
}

/** Todas las filas CF (marca_id NULL): pinned + b2c + b2b. Para el admin. */
export async function getAllHeaderSlidesCF(
  supabase: SupabaseClient,
): Promise<HeaderSlide[]> {
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .is('marca_id', null)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('[getAllHeaderSlidesCF]', error.message)
    return []
  }
  return (data ?? []) as HeaderSlide[]
}

/** Singleton/pinned CF por kind+variant (pinned ignora variant). null si no existe. */
export async function getHeaderSingleton(
  supabase: SupabaseClient,
  kind: HeaderSlideKind,
  variant: HeaderVariant,
): Promise<HeaderSlide | null> {
  const isPinned = HEADER_PINNED_KINDS.includes(kind)
  let q = supabase
    .from('header_slide_content')
    .select('*')
    .is('marca_id', null)
    .eq('slide_kind', kind)
    .eq('is_cf_pinned', isPinned)
  q = isPinned ? q.is('variant', null) : q.eq('variant', variant)

  const { data, error } = await q.maybeSingle()
  if (error) {
    console.error('[getHeaderSingleton]', error.message)
    return null
  }
  return (data as HeaderSlide) ?? null
}

// ---------------------------------------------------------------------------
// Portal (marca) — slides propios de una marca + pinned read-only.
// ---------------------------------------------------------------------------

/** Slides propios de la marca (marca_id = X). Para el portal self-service. */
export async function getMyHeaderSlides(
  supabase: SupabaseClient,
  marcaId: string,
): Promise<HeaderSlide[]> {
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .eq('marca_id', marcaId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('[getMyHeaderSlides]', error.message)
    return []
  }
  return (data ?? []) as HeaderSlide[]
}

/** Slides CF-pinned (pasos/principal). Se muestran read-only en el portal. */
export async function getPinnedHeaderSlides(
  supabase: SupabaseClient,
): Promise<HeaderSlide[]> {
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .eq('is_cf_pinned', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getPinnedHeaderSlides]', error.message)
    return []
  }
  return (data ?? []) as HeaderSlide[]
}

/** Singleton propio de la marca por kind (variant NULL en filas de marca). */
export async function getMyHeaderSingleton(
  supabase: SupabaseClient,
  marcaId: string,
  kind: HeaderSlideKind,
): Promise<HeaderSlide | null> {
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .eq('marca_id', marcaId)
    .eq('slide_kind', kind)
    .eq('is_cf_pinned', false)
    .is('variant', null)
    .maybeSingle()

  if (error) {
    console.error('[getMyHeaderSingleton]', error.message)
    return null
  }
  return (data as HeaderSlide) ?? null
}

export async function getHeaderSlideById(
  supabase: SupabaseClient,
  id: string,
): Promise<HeaderSlide | null> {
  const { data, error } = await supabase
    .from('header_slide_content')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getHeaderSlideById]', error.message)
    return null
  }
  return (data as HeaderSlide) ?? null
}
