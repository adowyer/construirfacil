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
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import {
  getAllModelContentMap,
  getAllCatalogImages,
  getAllCatalogAttributes,
} from '@/lib/supabase/queries/catalog_panels'
import { getFeaturedModels } from '@/lib/supabase/queries/featured'
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import CatalogPage from '@/components/catalog/CatalogPage'

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
  const [
    models,
    { data: brandContentAll },
    { data: lineContentAll },
    lineas,
    marcas,
    modelContentMap,
    catalogImages,
    catalogAttributes,
    featuredModels,
  ] = await Promise.all([
    getGroupedCatalog(
      supabase,
      selectedMarca ? { marcaId: selectedMarca.id } : {},
    ),
    supabase
      .from('brand_content')
      .select('*')
      .eq('status', 'active')
      .order('sort_order'),
    supabase
      .from('line_content')
      .select('*')
      .eq('status', 'active')
      .order('sort_order'),
    getAllLineas(supabase),
    getAllMarcas(supabase),
    getAllModelContentMap(supabase),
    getAllCatalogImages(supabase),
    getAllCatalogAttributes(supabase),
    getFeaturedModels(supabase, 8),
  ])

  // brand_content / line_content todavía son globales (no tienen marca_id).
  // Mientras no se migren a multi-marca (ver [[project_product_vision]]),
  // tanto el agregador como el catálogo de marca consumen el mismo set.
  const brandContent = brandContentAll ?? []
  const lineContent = lineContentAll ?? []

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
      const arr = footerCardsByMarca[c.marca_id] ?? []
      arr.push(c)
      footerCardsByMarca[c.marca_id] = arr
    }
  }

  return (
    <CatalogPage
      models={models}
      brandContent={brandContent}
      lineContent={lineContent}
      lineas={lineas}
      marcas={approvedMarcas}
      modelContentMap={modelContentMap}
      catalogImages={catalogImages}
      catalogAttributes={catalogAttributes}
      featuredModels={featuredModels}
      footerCardsByMarca={footerCardsByMarca}
      selectedMarca={selectedMarca}
    />
  )
}
