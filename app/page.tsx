import { createClient } from '@/lib/supabase/server'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const [models, { data: brandContent }, { data: lineContent }, lineas] = await Promise.all([
    getGroupedCatalog(supabase),
    supabase.from('brand_content').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('line_content').select('*').eq('status', 'active').order('sort_order'),
    getAllLineas(supabase),
  ])

  console.log('brandContent:', brandContent?.length, 'lineContent:', lineContent?.length, 'lineas:', lineas.length)

  return (
    <CatalogPage
      models={models}
      brandContent={brandContent ?? []}
      lineContent={lineContent ?? []}
      lineas={lineas}
    />
  )
}
