/**
 * app/modelos/[slug]/page.tsx
 *
 * Deep-link a un modelo del catálogo via slug canónico `casa-<tipo>-<style>`
 * (ej. `/modelos/casa-nodo-pampa`). Lo usan el botón Compartir y los enlaces
 * vivos en WhatsApp/Email/Instagram.
 *
 * Comportamiento:
 *   1. Carga el bag completo del agregador (loadHomeData) — mismo que `/`.
 *   2. Resuelve el slug contra los modelos:
 *      - Match → renderea CatalogPage con initialModelSlug={slug}; CatalogPage
 *        abre la station-overlay del modelo en mount.
 *      - Sin match (slug viejo, modelo renombrado/eliminado) → redirect 308
 *        a `/catalogo`. El visitante llega a un catálogo abierto en vez de
 *        un 404 que rompe el share que ya circuló.
 *   3. Genera <metadata> con display_name + cover_url para el preview de
 *      share/SEO. Para slugs inexistentes, metadata genérica.
 *
 * NO hay hard gate acá: el visitante anónimo ve el catálogo abierto + el
 * soft gate per-slide (planos/precio/perspectivas) cuando intenta abrir lo
 * protegido. La idea es maximizar "venía por una casa, terminó viendo todas".
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadHomeData } from '@/lib/content/home-data'
import CatalogPage from '@/components/catalog/CatalogPage'
import { modelGroupSlug } from '@/lib/content/model-slug'
import { currentClientEmail } from '@/lib/auth/get-current-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

type MatchedModel = NonNullable<Awaited<ReturnType<typeof findModel>>['model']>

// Slug canónico del modelo (el que va a Google). El sitemap, el canonical y
// el og:url deben coincidir con éste. Si falta circulación+morfología cae al
// legacy — misma lógica que `modelGroupSlug` internamente.
function canonicalSlug(m: MatchedModel): string {
  return modelGroupSlug({
    style_name: m.style_name,
    tipologia_code_new: m.tipologia_code_new,
    circulacion: m.circulacion,
    morfologia: m.morfologia,
  })
}

async function findModel(slug: string) {
  const supabase = await createClient()
  const data = await loadHomeData(supabase)
  // Slug normalizado a minúsculas: en el catálogo siempre lo generamos así,
  // pero shares pegados a mano podrían venir con mayúsculas.
  const target = slug.toLowerCase()
  // Backward-compat: matcheamos contra DOS variantes del slug del modelo:
  //   - Nuevo (post-0090): incluye circulacion + morfologia
  //     → `casa-ejes-cubo-copahue`
  //   - Legacy: sólo tipologia_code_new
  //     → `casa-cubo-copahue`
  // ModelRow pushea el nuevo cuando ambos campos están seteados; el botón
  // Compartir también usa el nuevo. Los shares viejos circulando en WhatsApp
  // pueden estar en cualquiera de los dos formatos.
  const model = data.models.find((m) => {
    const newSlug = modelGroupSlug({
      style_name: m.style_name,
      tipologia_code_new: m.tipologia_code_new,
      circulacion: m.circulacion,
      morfologia: m.morfologia,
    })
    if (newSlug === target) return true
    const legacySlug = modelGroupSlug({
      style_name: m.style_name,
      tipologia_code_new: m.tipologia_code_new,
    })
    return legacySlug === target
  })
  return { data, model }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { model } = await findModel(slug)
  if (!model) {
    return {
      title: 'Catálogo — ConstruirFácil',
      description:
        'Explorá modelos de casas industrializadas en ConstruirFácil.',
      // Slug muerto: no queremos que Google lo mantenga indexado.
      alternates: { canonical: '/catalogo' },
      robots: { index: false, follow: true },
    }
  }
  const title = `${model.display_name} — ConstruirFácil`
  const desc =
    model.concept_blurb ??
    `Modelo ${model.display_name} ${
      model.area_min ? `desde ${Math.round(model.area_min)} m²` : ''
    }${model.beds_min ? ` · ${model.beds_min} dorm.` : ''}.`
  // Canonical y og:url apuntan al slug NUEVO aunque el visitante haya
  // llegado por el legacy. Consolida autoridad en una sola URL y matchea
  // el sitemap. (El handler default redirige 308 al canónico, pero el
  // canonical lo dejamos coherente igual para cachés/prefetch.)
  const canonPath = `/modelos/${canonicalSlug(model)}`
  return {
    title,
    description: desc.trim(),
    alternates: { canonical: canonPath },
    openGraph: {
      type: 'website',
      url: canonPath,
      title,
      description: desc.trim(),
      siteName: 'ConstruirFácil',
      images: model.cover_url ? [{ url: model.cover_url }] : undefined,
    },
  }
}

export default async function ModeloPage({ params }: PageProps) {
  const { slug } = await params
  const { data, model } = await findModel(slug)

  // Slug stale (modelo renombrado/desactivado): preservamos la promesa de
  // share — el visitante igual aterriza en un catálogo navegable. notFound()
  // rompía links que ya circulaban en WhatsApp/Instagram sin recurso.
  if (!model) redirect('/catalogo')

  // Slug legacy pero existe versión nueva: 308 al canónico. Fusiona autoridad
  // SEO en una URL sola y evita que Google indexe dos URLs para el mismo
  // contenido. Shares viejos siguen funcionando (via redirect).
  const canon = canonicalSlug(model)
  if (canon !== slug.toLowerCase()) {
    redirect(`/modelos/${canon}`)
  }

  const clientEmail = await currentClientEmail()

  return (
    <CatalogPage
      {...data}
      selectedMarca={null}
      initialHomeMode={false}
      initialModelSlug={slug.toLowerCase()}
      isClientVerified={!!clientEmail}
    />
  )
}
