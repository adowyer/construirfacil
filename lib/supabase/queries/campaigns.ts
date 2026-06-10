/**
 * lib/supabase/queries/campaigns.ts
 *
 * Campañas de medios por localidad (schema: 0037_campaigns.sql).
 *
 * `getCampaignBySlug` la usa la ruta /casa-financiada/[localidad]: si hay una
 * campaña ACTIVA y EN VENTANA para ese slug, su copy reemplaza el slide
 * `principal` del HeroRow (el de arriba de todo, el que se tipea: "La casa
 * que querés…"). Resiliente: error / no-match → null, y la ruta cae al home
 * normal (nunca 404 — tráfico pago siempre aterriza).
 *
 * `campaignPrincipalSlide` convierte la campaña en un HeaderSlide sintético
 * (slide_kind='principal'); HeroRow toma el PRIMERO por kind, así que la
 * ruta lo antepone y gana. Cero cambios en HeroRow.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { HeaderSlide } from '@/lib/supabase/queries/header_content'

export interface Campaign {
  id: string
  slug: string
  /** Alias corto opcional para piezas impresas (construirfacil.com/<short_slug>).
   *  NO es el canónico — la atribución/UTM sigue por `slug`. */
  short_slug: string | null
  localidad: string
  provincia: string | null
  eyebrow: string | null
  headline: string
  subheadline: string | null
  cta_label: string | null
  image_url: string | null
  price_from: string | null
  active: boolean
  start_at: string | null
  end_at: string | null
}

/** Normaliza el slug del path para el lookup (lo que se guarda ya viene
 *  slugificado; acá sólo defendemos contra mayúsculas / espacios / barra). */
export function normalizeCampaignSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\/+$/, '')
}

/**
 * Campaña activa para `slug`, o null. "Activa" = active=true Y dentro de la
 * ventana [start_at, end_at] (cualquiera null = abierto). Degrada a null en
 * error (la ruta nunca rompe).
 */
export async function getCampaignBySlug(
  supabase: SupabaseClient,
  rawSlug: string,
): Promise<Campaign | null> {
  const slug = normalizeCampaignSlug(rawSlug)
  if (!slug) return null

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    console.error('[getCampaignBySlug]', error.message)
    return null
  }
  if (!data) return null

  const c = data as Campaign
  const now = Date.now()
  if (c.start_at && new Date(c.start_at).getTime() > now) return null
  if (c.end_at && new Date(c.end_at).getTime() < now) return null
  return c
}

/**
 * Campaña activa para `short_slug` (alias corto imprimible). Misma ventana
 * de activa/start/end que `getCampaignBySlug`. Usado por la ruta top-level
 * `/[campaignShort]/page.tsx`.
 */
export async function getCampaignByShortSlug(
  supabase: SupabaseClient,
  rawShortSlug: string,
): Promise<Campaign | null> {
  const shortSlug = normalizeCampaignSlug(rawShortSlug)
  if (!shortSlug) return null

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('short_slug', shortSlug)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    console.error('[getCampaignByShortSlug]', error.message)
    return null
  }
  if (!data) return null

  const c = data as Campaign
  const now = Date.now()
  if (c.start_at && new Date(c.start_at).getTime() > now) return null
  if (c.end_at && new Date(c.end_at).getTime() < now) return null
  return c
}

// ── Admin ───────────────────────────────────────────────────────────────────

/** Todas las campañas (más nuevas/activas primero). Admin. Degrada a []. */
export async function getAllCampaigns(
  supabase: SupabaseClient,
): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('active', { ascending: false })
    .order('localidad', { ascending: true })
  if (error) {
    console.error('[getAllCampaigns]', error.message)
    return []
  }
  return (data ?? []) as Campaign[]
}

/** Slugs de campañas activas y en ventana — para el sitemap. Degrada a []. */
export async function getActiveCampaignSlugs(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('slug, start_at, end_at')
    .eq('active', true)
  if (error) {
    console.error('[getActiveCampaignSlugs]', error.message)
    return []
  }
  const now = Date.now()
  return (data ?? [])
    .filter((c: { start_at: string | null; end_at: string | null }) => {
      if (c.start_at && new Date(c.start_at).getTime() > now) return false
      if (c.end_at && new Date(c.end_at).getTime() < now) return false
      return true
    })
    .map((c: { slug: string }) => c.slug)
}

/** Una campaña por id (admin/editor). Degrada a null. */
export async function getCampaignById(
  supabase: SupabaseClient,
  id: string,
): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getCampaignById]', error.message)
    return null
  }
  return (data as Campaign) ?? null
}

/** Slugifica una localidad ("San Carlos de Bolívar" → san-carlos-de-bolivar). */
export function slugifyLocalidad(raw: string): string {
  return (
    raw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // saca acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ''
  )
}

// ── Generador de links UTM ───────────────────────────────────────────────────

/**
 * `utm_campaign` ESTABLE para roll-up de toda la ola (todas las localidades
 * suman acá). El medio va en utm_source; la localidad en utm_content (=slug).
 * Si se corre otra ola, cambiar este valor (o el campo del generador).
 */
export const UTM_CAMPAIGN_DEFAULT = 'casa-financiada'

/**
 * Link de campaña UTM-eado. El contenido lo decide el PATH (`slug`); los UTM
 * sólo miden. utm_content = slug (llave canónica). Puro = testeable.
 */
export function buildCampaignUtmUrl(args: {
  origin: string
  slug: string
  source: string
  medium?: string
  campaign?: string
  term?: string
}): string {
  const base = args.origin.replace(/\/+$/, '')
  const slug = normalizeCampaignSlug(args.slug)
  const qs = new URLSearchParams()
  qs.set('utm_source', slugifyLocalidad(args.source) || 'medio')
  qs.set('utm_medium', (args.medium || 'display').trim())
  qs.set('utm_campaign', (args.campaign || UTM_CAMPAIGN_DEFAULT).trim())
  qs.set('utm_content', slug)
  const term = args.term?.trim()
  if (term) qs.set('utm_term', term)
  return `${base}/casa-financiada/${slug}?${qs.toString()}`
}

/**
 * HeaderSlide sintético `principal` desde una campaña: reemplaza el slide
 * que se tipea arriba de todo. `title` = headline local (lo que el
 * typewriter de SlidePrincipal escribe). HeroRow toma el PRIMER slide por
 * kind → la ruta lo antepone y gana sobre el principal por defecto/DB.
 */
export function campaignPrincipalSlide(c: Campaign): HeaderSlide {
  return {
    id: `campaign-principal-${c.slug}`,
    marca_id: null,
    variant: 'b2c',
    is_cf_pinned: false,
    slide_kind: 'principal',
    admin_label: `Campaña ${c.localidad}`,
    eyebrow: null,
    title: c.headline,
    subtitle: null,
    body: null,
    cta_label: null,
    cta_url: null,
    image_url: null,
    panel_image_url: null,
    long_body: null,
    bg: null,
    narrow: null,
    gallery_urls: [],
    sort_order: -1000,
    status: 'active',
    // El typewriter del slide principal usa esto para renderizar la localidad
    // en negrita dentro del headline a medida que se va tipeando.
    bold_term: c.localidad,
  }
}
