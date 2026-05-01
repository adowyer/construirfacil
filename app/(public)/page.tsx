import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGroupedCatalog } from '@/lib/supabase/queries/catalog_grouped'
import CatalogPage from '@/components/catalog/CatalogPage'
import '../catalog.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil',
  description: 'La casa que queres, al precio que necesitás. Construir nunca fue tan fácil.',
}

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const models = await getGroupedCatalog(supabase)
    return <CatalogPage models={models} />
  } catch (err) {
    console.error('[HomePage]', err)
    return <CatalogPage models={[]} />
  }
}