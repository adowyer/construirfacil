/**
 * app/(public)/catalog/page.tsx
 *
 * Página pública del catálogo Hausind.
 * Carga modelos agrupados de Supabase y pasa al componente CatalogPage.
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Catálogo — HAUSIND',
  description: 'Explorá los modelos de casas HAUSIND: Bosque, Atlas y Terra. Encontrá la casa que querés al precio que necesitás.',
}

export default async function CatalogRoute() {
  const supabase = await createClient()
  const models = await getGroupedCatalog(supabase)

  console.log('models count:', models.length, models[0])

  return <CatalogPage models={models} />
}