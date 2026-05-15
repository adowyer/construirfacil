/**
 * app/page.tsx
 *
 * Home de ConstruirFácil. No es una landing separada — el catálogo VIVE acá,
 * solo que arranca con `initialHomeMode={true}`: la grilla de modelos está
 * oculta y se muestra el HomeSlider (segundo slider con copy editorial) entre
 * el HeroRow y donde irían los filtros sticky.
 *
 * Click en cualquier CTA "Ver catálogo" dentro del HomeSlider → toggle a modo
 * catálogo (grilla aparece). Click en "Inicio" del breadcrumb (cuando estamos
 * en modo catálogo) → vuelve a modo home. La transición es client-side, no
 * hay navegación.
 *
 * Si alguien entra directo via /catalogo o /catalogo/{marca}, ese page hace
 * el mismo fetch pero con `initialHomeMode={false}` → entra directo al
 * catálogo desplegado.
 *
 * Landings v1 (single-screen 5 items) y v2 (slideshow + Mac mockup) ambas
 * archivadas en _archive/ por si hay que recuperarlas.
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
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil — La manera más inteligente y fácil de construir.',
  description:
    'Explorá cientos de diseños de casas industrializadas de las mejores marcas. Compará líneas, estilos y precios, encontrá tu casa ideal en un solo lugar.',
}

export default async function HomePage() {
  const supabase = await createClient()

  // Mismo fetch que /catalogo/[[...marca]]/page.tsx pero sin marcaSlug —
  // queremos todos los modelos de todas las marcas aprobadas, igual que el
  // agregador. La única diferencia es `initialHomeMode={true}` al final.
  // Home = agregador sin marca activa → contenido GLOBAL (marca_id NULL).
  // Hoy todas las filas son globales, así que es idéntico al comportamiento
  // anterior. Cuando se carguen overrides per-marca, el agregador sigue
  // mostrando el global; cada /catalogo/{marca} prefiere el suyo.
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
  ])

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
      scContent={scContent}
      lineas={lineas}
      marcas={approvedMarcas}
      modelContentMap={modelContentMap}
      catalogImages={catalogImages}
      catalogAttributes={catalogAttributes}
      featuredModels={featuredModels}
      footerCardsByMarca={footerCardsByMarca}
      selectedMarca={null}
      initialHomeMode={true}
    />
  )
}
