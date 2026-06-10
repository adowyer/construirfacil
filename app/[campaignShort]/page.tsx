/**
 * app/[campaignShort]/page.tsx
 *
 * Alias corto IMPRIMIBLE de una campaña. Resuelve `campaigns.short_slug` y, si
 * matchea una campaña activa y en ventana, renderiza el mismo contenido que
 * /casa-financiada/[localidad]. NO redirige: queremos que la URL se mantenga
 * (lo que está impreso es lo que se ve).
 *
 * Precedencia: en App Router los segmentos estáticos ganan a los dinámicos,
 * así que /admin /api /modelos /catalogo /casa-financiada etc. no caen acá.
 * Igual defendemos con una lista de reservados por si alguien guarda un
 * short_slug colisivo desde el admin (defensa en profundidad).
 *
 * SEO: canonical → /casa-financiada/<slug> + noindex. La URL corta es para
 * impresión / vía pública (sin UTMs); el long slug sigue siendo el canónico.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadHomeData } from '@/lib/content/home-data'
import {
  getCampaignByShortSlug,
  campaignPrincipalSlide,
} from '@/lib/supabase/queries/campaigns'
import { SITE_URL } from '@/lib/seo/site'
import CatalogPage from '@/components/catalog/CatalogPage'
import { CampaignTracker } from '@/components/catalog/CampaignTracker'

export const dynamic = 'force-dynamic'

// Reservados (estáticos ya ganan, pero defendemos contra short_slug colisivo
// configurado por error desde el admin).
const RESERVED = new Set([
  'admin', 'api', 'auth', 'casa-financiada', 'catalogo', 'cotizar',
  'data-deletion', 'empresas', 'modelos', 'portal', '_track',
  'gate', 'login', 'register', 'marcas', 'models', 'privacidad', 'terminos',
  'sitemap.xml', 'robots.txt', 'favicon.ico', 'apple-icon.png', 'icon.png',
])

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaignShort: string }>
}): Promise<Metadata> {
  const { campaignShort } = await params
  if (RESERVED.has(campaignShort)) return { robots: { index: false, follow: false } }

  const supabase = await createClient()
  const campaign = await getCampaignByShortSlug(supabase, campaignShort)
  if (!campaign) return { robots: { index: false, follow: false } }

  const description =
    campaign.subheadline ??
    'Elegí tu casa industrializada llave en mano, con financiación. Compará modelos y precios reales.'

  return {
    title: `${campaign.headline} | ConstruirFácil`,
    description,
    // Canonical apunta al PATH largo: dedup SEO. La URL corta queda fuera del
    // índice (es solo para impresión / boca a boca).
    alternates: { canonical: `/casa-financiada/${campaign.slug}` },
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      url: `/${campaignShort}`,
      title: campaign.headline,
      description,
      siteName: 'ConstruirFácil',
      ...(campaign.image_url ? { images: [campaign.image_url] } : {}),
    },
  }
}

export default async function CampaignShortLandingPage({
  params,
}: {
  params: Promise<{ campaignShort: string }>
}) {
  const { campaignShort } = await params
  if (RESERVED.has(campaignShort)) notFound()

  const supabase = await createClient()
  const [data, campaign] = await Promise.all([
    loadHomeData(supabase),
    getCampaignByShortSlug(supabase, campaignShort),
  ])

  if (!campaign) notFound()

  // Mismo patrón que /casa-financiada/[localidad]: anteponemos el slide
  // sintético `principal` al HeroRow y HomeRow se queda como está.
  const headerSlides = [campaignPrincipalSlide(campaign), ...data.headerSlides]

  function provinciaIdFromCampaign(): string | null {
    const raw = campaign?.provincia?.trim()
    if (!raw) return null
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const target = norm(raw)
    const match = data.provincias.find(
      (p) => norm(p.name) === target || p.slug === target,
    )
    return match?.id ?? null
  }
  const initialProvinciaId = provinciaIdFromCampaign()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: campaign.headline,
    serviceType: 'Construcción de viviendas industrializadas llave en mano',
    url: `${SITE_URL}/casa-financiada/${campaign.slug}`,
    provider: {
      '@type': 'Organization',
      name: 'ConstruirFácil',
      url: SITE_URL,
    },
    areaServed: {
      '@type': 'Place',
      name: [campaign.localidad, campaign.provincia].filter(Boolean).join(', '),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CampaignTracker />
      <CatalogPage
        {...data}
        headerSlides={headerSlides}
        selectedMarca={null}
        initialHomeMode={true}
        initialProvinciaId={initialProvinciaId}
      />
    </>
  )
}
