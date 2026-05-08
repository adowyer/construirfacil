import { createClient } from '@/lib/supabase/server'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import {
  getAllModelContentMap,
  getAllCatalogImages,
  getAllCatalogAttributes,
} from '@/lib/supabase/queries/catalog_panels'
import { getFeaturedModels } from '@/lib/supabase/queries/featured'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const [
    models,
    { data: brandContent },
    { data: lineContent },
    lineas,
    modelContentMap,
    catalogImages,
    catalogAttributes,
    featuredModels,
  ] = await Promise.all([
    getGroupedCatalog(supabase),
    supabase.from('brand_content').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('line_content').select('*').eq('status', 'active').order('sort_order'),
    getAllLineas(supabase),
    getAllModelContentMap(supabase),
    getAllCatalogImages(supabase),
    getAllCatalogAttributes(supabase),
    getFeaturedModels(supabase, 8),
  ])

  return (
    <CatalogPage
      models={models}
      brandContent={brandContent ?? []}
      lineContent={lineContent ?? []}
      lineas={lineas}
      modelContentMap={modelContentMap}
      catalogImages={catalogImages}
      catalogAttributes={catalogAttributes}
      featuredModels={featuredModels}
    />
  )
}
