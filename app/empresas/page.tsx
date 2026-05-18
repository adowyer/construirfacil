/**
 * app/empresas/page.tsx
 *
 * Versión B2B de ConstruirFácil (para marcas / fabricantes). Misma
 * experiencia que el home B2C (HeroRow + HomeRow editorial) pero:
 *   - El HeroRow usa el contenido de la versión B2B (header_slide_content,
 *     variant 'b2b' ∪ pinned) — editable desde /admin/header.
 *   - El HomeRow usa el copy B2B.
 *   - "Ver catálogo" navega al catálogo B2C abierto (/catalogo) en vez de
 *     abrir el catálogo inline.
 *
 * Mismo fetch que app/page.tsx; la única diferencia es variant='b2b' y los
 * headerSlides resueltos para b2b. (La landing v2 LandingCF fue removida.)
 */

import type { Metadata } from 'next'
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
import { getActiveSistemaConstructivo } from '@/lib/supabase/queries/sistema-constructivo'
import {
  getResolvedBrandContent,
  getResolvedLineContent,
} from '@/lib/supabase/queries/content_resolve'
import { getResolvedHeaderSlides } from '@/lib/supabase/queries/header_content'
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import { getFooterContent } from '@/lib/supabase/queries/footer'
import { getResolvedHomeSlides } from '@/lib/supabase/queries/home_content'
import { getDeliveryConditions } from '@/lib/supabase/queries/delivery_conditions'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil para Marcas — Sumá tu catálogo al marketplace',
  description:
    'Solución comercial B2B con inteligencia artificial, tráfico garantizado y catálogo inteligente. Sumá tu marca a ConstruirFácil y escalá tus ventas.',
}

export default async function EmpresasPage() {
  const supabase = await createClient()

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
  ] = await Promise.all([
    getGroupedCatalog(supabase, {}),
    getResolvedBrandContent(supabase, null),
    getResolvedLineContent(supabase, null),
    getAllLineas(supabase),
    getAllMarcas(supabase),
    getAllModelContentMap(supabase),
    getAllCatalogImages(supabase),
    getAllCatalogAttributes(supabase),
    getFeaturedModels(supabase, 8),
    getActiveSistemaConstructivo(supabase),
    // Versión B2B: filas marca_id NULL + variant 'b2b' ∪ pinned.
    getResolvedHeaderSlides(supabase, { marcaId: null, variant: 'b2b' }),
    getFooterContent(supabase),
    getResolvedHomeSlides(supabase, { marcaId: null, variant: 'b2b' }),
    getDeliveryConditions(supabase, null),
  ])

  const deliveryConditionsHtml = deliveryConditions?.body?.trim() || null

  const approvedMarcas = marcas.filter((m) => m.status === 'approved')

  const footerCardsByMarca: Record<string, FooterCardRow[]> = {}
  const marcaIdsForFooter = approvedMarcas.map((m) => m.id)
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
      selectedMarca={null}
      initialHomeMode={true}
      variant="b2b"
    />
  )
}
