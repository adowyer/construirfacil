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
  try {
    const supabase = await createClient()
    const slugs = await getActiveCampaignSlugs(supabase)
    campaignUrls = slugs.map((slug) => ({
      url: `${SITE_URL}/casa-financiada/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch {
    /* sin DB → sitemap igual con las páginas base */
  }

  return [...base, ...campaignUrls]
}
