/**
 * app/casa-financiada/[localidad]/page.tsx
 *
 * Landing de campaña de medios. Mismo home/agregador que `/`, pero si hay una
 * campaña ACTIVA para `[localidad]`, su copy local se inyecta como BANNER al
 * tope del HomeRow → message-match con el creativo del medio.
 *
 * `[localidad]` (= slug = utm_content = campaign_slug) es la fuente de verdad
 * del contenido. Los UTM van encima sólo para medición; si un medio los
 * stripea, el contenido igual matchea porque vive en el path.
 *
 * FALLBACK DURO: slug inexistente / inactivo / fuera de ventana / typo →
 * home normal. NUNCA notFound() — tráfico pago siempre aterriza en algo
 * coherente.
 *
 * SEO (Fase 6): canonical = el path (sin UTM → no diluye); campaña →
 * indexable + OG; fallback (sin campaña) → canonical a `/` + noindex (no
 * duplicar la home). JSON-LD Service con areaServed = localidad.
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { loadHomeData } from '@/lib/content/home-data'
import {
  getCampaignBySlug,
  campaignPrincipalSlide,
} from '@/lib/supabase/queries/campaigns'
import { SITE_URL } from '@/lib/seo/site'
import CatalogPage from '@/components/catalog/CatalogPage'
import { CampaignTracker } from '@/components/catalog/CampaignTracker'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ localidad: string }>
}): Promise<Metadata> {
  const { localidad } = await params
  const supabase = await createClient()
  const campaign = await getCampaignBySlug(supabase, localidad)

  // Sin campaña: la página muestra la home → canonical a "/" + noindex
  // (no indexar un duplicado de la home con un slug muerto).
  if (!campaign) {
    return {
      title:
        'ConstruirFácil — La manera más inteligente y fácil de construir.',
      description:
        'Explorá cientos de diseños de casas industrializadas de las mejores marcas. Compará líneas, estilos y precios, encontrá tu casa ideal en un solo lugar.',
      alternates: { canonical: '/' },
      robots: { index: false, follow: true },
    }
  }

  const path = `/casa-financiada/${campaign.slug}`
  const description =
    campaign.subheadline ??
    'Elegí tu casa industrializada llave en mano, con financiación. Compará modelos y precios reales.'

  return {
    title: `${campaign.headline} | ConstruirFácil`,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: path,
      title: campaign.headline,
      description,
      siteName: 'ConstruirFácil',
      ...(campaign.image_url ? { images: [campaign.image_url] } : {}),
    },
  }
}

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ localidad: string }>
}) {
  const { localidad } = await params
  const supabase = await createClient()

  const [data, campaign] = await Promise.all([
    loadHomeData(supabase),
    getCampaignBySlug(supabase, localidad),
  ])

  // Campaña → reemplaza el slide `principal` del HeroRow (el que se tipea
  // arriba de todo). HeroRow toma el primer slide por kind → lo anteponemos
  // y gana. Sin campaña → header normal. El HomeRow inferior NO se toca.
  const headerSlides = campaign
    ? [campaignPrincipalSlide(campaign), ...data.headerSlides]
    : data.headerSlides

  // Provincia inicial: si la campaña la declara, la matcheamos contra el
  // seed de provincias (por slug primero, luego por nombre normalizado).
  // Permite que la landing arranque ya filtrada por la zona de la localidad
  // (aplica modifier / extra_charge / promo de la marca para esa provincia).
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

  const jsonLd = campaign
    ? {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: campaign.headline,
        serviceType:
          'Construcción de viviendas industrializadas llave en mano',
        url: `${SITE_URL}/casa-financiada/${campaign.slug}`,
        provider: {
          '@type': 'Organization',
          name: 'ConstruirFácil',
          url: SITE_URL,
        },
        areaServed: {
          '@type': 'Place',
          name: [campaign.localidad, campaign.provincia]
            .filter(Boolean)
            .join(', '),
        },
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CampaignTracker campaignSlug={campaign?.slug} />
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
