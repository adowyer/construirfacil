/**
 * app/admin/models/page.tsx
 * Admin CRUD list for house_catalog, agrupado por línea.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllModelsAdmin } from '@/lib/supabase/queries/models'
import { CatalogTable, type LineaInfo } from '@/components/admin/CatalogTable'

export default async function AdminModelsPage() {
  const supabase = await createClient()

  const [rows, lineasResult] = await Promise.all([
    getAllModelsAdmin(supabase),
    supabase
      .from('lineas')
      .select('name, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  const lineas: LineaInfo[] =
    (lineasResult.data ?? []).map((l) => ({
      name: l.name as string,
      sort_order: (l.sort_order as number) ?? 0,
    }))

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">Modelos</h1>
        <Link
          href="/admin/models/new"
          className="bg-black text-white px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          Nuevo modelo
        </Link>
      </div>

      <CatalogTable rows={rows} lineas={lineas} />
    </div>
  )
}
