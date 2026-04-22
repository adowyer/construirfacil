/**
 * app/admin/models/page.tsx
 * Admin CRUD list for house_catalog.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CatalogTable } from '@/components/admin/CatalogTable'

export default async function AdminModelsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('house_catalog')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[AdminModelsPage]', error.message)
  }

  const rows = data ?? []

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

      <CatalogTable rows={rows} />
    </div>
  )
}
