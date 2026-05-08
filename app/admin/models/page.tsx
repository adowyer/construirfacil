/**
 * app/admin/models/page.tsx
 * Admin CRUD list for house_catalog, agrupado por línea.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllModelsAdmin } from '@/lib/supabase/queries/models'
import { CatalogTable, type LineaInfo } from '@/components/admin/CatalogTable'
import { Home as HomeIcon, Plus } from 'lucide-react'

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
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm shrink-0">
            <HomeIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">
              Modelos
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {rows.length} {rows.length === 1 ? 'modelo cargado' : 'modelos cargados'}
            </p>
          </div>
        </div>
        <Link
          href="/admin/models/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors flex items-center gap-2 shadow-md shadow-[#ff003d]/20"
        >
          <Plus className="w-4 h-4" />
          Nuevo modelo
        </Link>
      </div>

      <CatalogTable rows={rows} lineas={lineas} />
    </div>
  )
}
