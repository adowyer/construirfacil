/**
 * lib/content/home-data.ts
 *
 * Fuente ÚNICA del armado de datos del home/agregador (el mismo bag que
 * `app/page.tsx` pasaba a <CatalogPage>). Lo consumen:
 *   - app/page.tsx (home `/`)
 *   - app/casa-financiada/[localidad]/page.tsx (landing de campaña: mismo
 *     bag + banner de campaña inyectado al tope del HomeRow)
 *
 * Extraído verbatim de app/page.tsx para que ambas rutas no divergan.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
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
import { loadCotizadorData } from '@/lib/content/cotizador-data'
import { getInstitutionalFooterCards } from '@/lib/supabase/queries/footer'
import { getAllProvincias, getActiveMarcaZonas } from '@/lib/supabase/queries/zones'

export async function loadHomeData(supabase: SupabaseClient) {
  // Home = agregador sin marca activa → contenido GLOBAL (marca_id NULL),
  // versión CF B2C (variant b2c). Idéntico al fetch que hacía app/page.tsx.
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
    getResolvedHeaderSlides(supabase, { marcaId: null, variant: 'b2c' }),
    getFooterContent(supabase),
    getResolvedHomeSlides(supabase, { marcaId: null, variant: 'b2c' }),
    getDeliveryConditions(supabase, null),
    loadCotizadorData(supabase),
    getInstitutionalFooterCards(supabase),
    getAllProvincias(supabase),
    getActiveMarcaZonas(supabase),
  ])

  const deliveryConditionsHtml = deliveryConditions?.body?.trim() || null
  const approvedMarcas = marcas.filter((m) => m.status === 'approved')

  // Footer cards de todas las marcas aprobadas (como en el agregador).
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
      if (!c.marca_id) continue // institucionales se manejan aparte
      const arr = footerCardsByMarca[c.marca_id] ?? []
      arr.push(c)
      footerCardsByMarca[c.marca_id] = arr
    }
  }

  return {
    models,
    brandContent,
    lineContent,
    headerSlides,
    scContent,
    lineas,
    marcas: approvedMarcas,
    modelContentMap,
    catalogImages,
    catalogAttributes,
    featuredModels,
    footerCardsByMarca,
    footerContent,
    homeSlides,
    deliveryConditionsHtml,
    cotizador,
    institutionalFooterCards,
    provincias,
    marcaZonas,
  }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>
