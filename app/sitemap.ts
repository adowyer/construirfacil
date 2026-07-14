/**
 * app/sitemap.ts
 * Páginas públicas + una entrada por campaña ACTIVA (/casa-financiada/<slug>),
 * para que esas landings rankeen ("casas en <localidad>"). force-dynamic:
 * una campaña nueva aparece en el sitemap sin redeploy.
 */
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site'
import { createClient } from '@/lib/supabase/server'
import { getActiveCampaignSlugs } from '@/lib/supabase/queries/campaigns'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import { modelGroupSlug } from '@/lib/content/model-slug'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/empresas`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terminos`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  let campaignUrls: MetadataRoute.Sitemap = []
  let modelUrls: MetadataRoute.Sitemap = []
  try {
    const supabase = await createClient()
    const [slugs, models] = await Promise.all([
      getActiveCampaignSlugs(supabase),
      getGroupedCatalog(supabase, {}),
    ])
    campaignUrls = slugs.map((slug) => ({
      url: `${SITE_URL}/casa-financiada/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
    // Solo modelos con tipologia_code_new → slug canónico estable. Los que
    // todavía no migraron se omiten (no rompemos sitemap si una marca queda
    // fuera del nuevo esquema). El slug lleva circulacion+morfologia cuando
    // están presentes (post-0090) — mismo formato que ModelRow/ShareButton
    // pushean a la barra. Sin coherencia acá Google indexa dos URLs para el
    // mismo contenido y partimos la autoridad.
    const seen = new Set<string>()
    modelUrls = models
      .map((m) => {
        if (!m.tipologia_code_new) return null
        const slug = modelGroupSlug({
          style_name: m.style_name,
          tipologia_code_new: m.tipologia_code_new,
          circulacion: m.circulacion,
          morfologia: m.morfologia,
        })
        if (seen.has(slug)) return null
        seen.add(slug)
        return {
          url: `${SITE_URL}/modelos/${slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)
  } catch {
    /* sin DB → sitemap igual con las páginas base */
  }

  return [...base, ...campaignUrls, ...modelUrls]
}
