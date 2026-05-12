/**
 * app/catalogo/page.tsx
 *
 * Catálogo público completo. Antes vivía en /, pero / ahora es la landing
 * editorial de ConstruirFácil. El catálogo se accede desde los CTAs de la
 * landing y del header.
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
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Catálogo — ConstruirFácil',
  description:
    'Catálogo completo de casas industrializadas. Filtrá por línea, estilo, tamaño y dormitorios.',
}

export default async function CatalogoPage() {
  const supabase = await createClient()

  const [
    models,
    { data: brandContent },
    { data: lineContent },
    lineas,
    marcas,
    modelContentMap,
    catalogImages,
    catalogAttributes,
    featuredModels,
  ] = await Promise.all([
    getGroupedCatalog(supabase),
    supabase.from('brand_content').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('line_content').select('*').eq('status', 'active').order('sort_order'),
    getAllLineas(supabase),
    getAllMarcas(supabase),
    getAllModelContentMap(supabase),
    getAllCatalogImages(supabase),
    getAllCatalogAttributes(supabase),
    getFeaturedModels(supabase, 8),
  ])

  // Solo marcas aprobadas en el footer público.
  const approvedMarcas = marcas.filter((m) => m.status === 'approved')

  // Footer cards de las marcas aprobadas, indexadas por marca_id. Si la
  // marca primaria no tiene cards, el CatalogFooter cae al hardcode.
  const footerCardsByMarca: Record<string, FooterCardRow[]> = {}
  if (approvedMarcas.length > 0) {
    const { data: footerCards } = await supabase
      .from('footer_card_content')
      .select('*')
      .in(
        'marca_id',
        approvedMarcas.map((m) => m.id),
      )
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
      brandContent={brandContent ?? []}
      lineContent={lineContent ?? []}
      lineas={lineas}
      marcas={approvedMarcas}
      modelContentMap={modelContentMap}
      catalogImages={catalogImages}
      catalogAttributes={catalogAttributes}
      featuredModels={featuredModels}
      footerCardsByMarca={footerCardsByMarca}
    />
  )
}
