/**
 * app/catalogo/[[...marca]]/page.tsx
 *
 * Catálogo público. Optional catch-all route que sirve dos URLs:
 *
 *   /catalogo              → agregador genérico (todas las marcas aprobadas).
 *                            Breadcrumb: Home › Catálogo (con select de marca).
 *   /catalogo/{slug}       → catálogo específico de la marca con ese slug.
 *                            Filtra models, brand_content, line_content y
 *                            footer_card_content por marca_id. Breadcrumb:
 *                            Home › Catálogo › {Marca}.
 *
 * Reusa el mismo componente <CatalogPage /> con prop `selectedMarca`.
 * Si la marca no existe o no está aprobada → 404.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCotizadorData } from '@/lib/content/cotizador-data'
import { getAllProvincias, getActiveMarcaZonas } from '@/lib/supabase/queries/zones'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import { getInstitutionalFooterCards } from '@/lib/supabase/queries/footer'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import {
  getAllModelContentMap,
  getAllCatalogImages,
  getAllCatalogAttributes,
} from '@/lib/supabase/queries/catalog_panels'
import { getFeaturedModels } from '@/lib/supabase/queries/featured'
import { getActiveSistemaConstructivo } from '@/lib/supabase/queries/sistema-constructivo'
import {
  getResolvedBrandContent,
  getResolvedLineContent,
} from '@/lib/supabase/queries/content_resolve'
import { getResolvedHeaderSlides } from '@/lib/supabase/queries/header_content'
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import type { PromoMessage } from '@/lib/supabase/queries/promos'
import { getFooterContent } from '@/lib/supabase/queries/footer'
import { getResolvedHomeSlides } from '@/lib/supabase/queries/home_content'
import { getDeliveryConditions } from '@/lib/supabase/queries/delivery_conditions'
import CatalogPage from '@/components/catalog/CatalogPage'
import { currentClientEmail } from '@/lib/auth/get-current-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ marca?: string[] }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { marca } = await params
  const marcaSlug = marca?.[0]

  if (!marcaSlug) {
    return {
      title: 'Catálogo — ConstruirFácil',
      description:
        'Catálogo completo de casas industrializadas — todas las marcas, líneas y modelos. Filtrá por marca, línea, estilo, tamaño y dormitorios.',
    }
  }

  const supabase = await createClient()
  const { data: m } = await supabase
    .from('marcas')
    .select('name')
    .eq('slug', marcaSlug)
    .eq('status', 'approved')
    .maybeSingle()

  if (!m) return { title: 'Catálogo — ConstruirFácil' }

  return {
    title: `Catálogo ${m.name} — ConstruirFácil`,
    description: `Modelos de ${m.name}. Filtrá por línea, estilo, tamaño y dormitorios.`,
  }
}

export default async function CatalogoPage({ params }: PageProps) {
  const { marca } = await params
  const marcaSlug = marca?.[0] ?? null

  // Tirar 404 si vienen segmentos extra (ej. /catalogo/hausind/X/Y).
  if (marca && marca.length > 1) notFound()

  // ── Auth gate ─────────────────────────────────────────────────────────
  // El listado del catálogo queda ABIERTO (mejor SEO + first impression).
  // El gate se dispara cuando el visitante quiere ver el DETALLE de una
  // casa (expandir model row o entrar a /modelos/[slug] directo). Acá solo
  // leemos la cookie para pasarla a CatalogPage como prop.
  const clientEmail = await currentClientEmail()

  const supabase = await createClient()

  // ── Marca activa (si hay slug en la URL) ──────────────────────────────
  let selectedMarca:
    | { id: string; name: string; slug: string; logo_url: string | null }
    | null = null
  if (marcaSlug) {
    const { data } = await supabase
      .from('marcas')
      .select('id, name, slug, logo_url')
      .eq('slug', marcaSlug)
      .eq('status', 'approved')
      .maybeSingle()
    if (!data) notFound()
    selectedMarca = data
  }

  // ── Catálogo y datos auxiliares ───────────────────────────────────────
  // Contenido resuelto por marca activa: /catalogo/{marca} prefiere las
  // filas de esa marca y cae a las globales; el agregador (sin marca) usa
  // solo globales. Las filas existentes son todas globales → sin overrides
  // el resultado es idéntico al comportamiento anterior.
  const resolveMarcaId = selectedMarca?.id ?? null
  const [
    models,
    brandContent,
    lineContent,
    lineas,
    marcas,
    modelContentMap,
    catalogImages,
    catalogAttributes,
    featuredModels,
    scContent,
    headerSlides,
    footerContent,
    homeSlides,
    deliveryConditions,
    cotizador,
    institutionalFooterCards,
    provincias,
    marcaZonas,
  ] = await Promise.all([
    getGroupedCatalog(
      supabase,
      selectedMarca ? { marcaId: selectedMarca.id } : {},
    ),
    getResolvedBrandContent(supabase, resolveMarcaId),
    getResolvedLineContent(supabase, resolveMarcaId),
    getAllLineas(supabase),
    getAllMarcas(supabase),
    getAllModelContentMap(supabase),
    getAllCatalogImages(supabase),
    getAllCatalogAttributes(supabase),
    getFeaturedModels(supabase, 8),
    getActiveSistemaConstructivo(supabase),
    // Marca activa → su versión ∪ pinned. Agregador (sin marca) → CF B2C ∪
    // pinned. B2B (/empresas) se maneja en Fase 4 con variant 'b2b'.
    getResolvedHeaderSlides(supabase, { marcaId: resolveMarcaId, variant: 'b2c' }),
    getFooterContent(supabase),
    getResolvedHomeSlides(supabase, { marcaId: resolveMarcaId, variant: 'b2c' }),
    getDeliveryConditions(supabase, resolveMarcaId),
    loadCotizadorData(supabase),
    getInstitutionalFooterCards(supabase),
    getAllProvincias(supabase),
    getActiveMarcaZonas(supabase),
  ])

  const deliveryConditionsHtml = deliveryConditions?.body?.trim() || null

  // Solo marcas aprobadas en el footer público.
  const approvedMarcas = marcas.filter((m) => m.status === 'approved')

  // Footer cards: si hay marca activa solo las suyas; si no, las de todas.
  const footerCardsByMarca: Record<string, FooterCardRow[]> = {}
  const marcaIdsForFooter = selectedMarca
    ? [selectedMarca.id]
    : approvedMarcas.map((m) => m.id)
  if (marcaIdsForFooter.length > 0) {
    const { data: footerCards } = await supabase
      .from('footer_card_content')
      .select('*')
      .in('marca_id', marcaIdsForFooter)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })

    for (const c of (footerCards ?? []) as FooterCardRow[]) {
      if (!c.marca_id) continue // institucionales se manejan aparte
      const arr = footerCardsByMarca[c.marca_id] ?? []
      arr.push(c)
      footerCardsByMarca[c.marca_id] = arr
    }
  }

  // Promos admin-driven (banners del catálogo). Mismo criterio que footer:
  // si hay marca activa solo las suyas, si no, las de todas las marcas
  // aprobadas. El cliente filtra por provincia con filterPromosForProvincia.
  let promos: PromoMessage[] = []
  if (marcaIdsForFooter.length > 0) {
    const { data: promoRows } = await supabase
      .from('promo_messages')
      .select(
        'id, marca_id, provincia_id, scope, titulo, cuerpo, color, cta_label, cta_action, activo, sort_order, starts_at, ends_at',
      )
      .in('marca_id', marcaIdsForFooter)
      .eq('activo', true)
      .order('sort_order', { ascending: true })
    promos = (promoRows ?? []) as PromoMessage[]
  }

  return (
    <CatalogPage
      models={models}
      brandContent={brandContent}
      lineContent={lineContent}
      headerSlides={headerSlides}
      scContent={scContent}
      lineas={lineas}
      marcas={approvedMarcas}
      modelContentMap={modelContentMap}
      catalogImages={catalogImages}
      catalogAttributes={catalogAttributes}
      featuredModels={featuredModels}
      footerCardsByMarca={footerCardsByMarca}
      footerContent={footerContent}
      homeSlides={homeSlides}
      deliveryConditionsHtml={deliveryConditionsHtml}
      selectedMarca={selectedMarca}
      cotizador={cotizador}
      institutionalFooterCards={institutionalFooterCards}
      provincias={provincias}
      marcaZonas={marcaZonas}
      promos={promos}
      isClientVerified={!!clientEmail}
    />
  )
}
