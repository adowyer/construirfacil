/**
 * app/admin/promos/new/page.tsx
 * Form para crear un banner nuevo.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { getAllProvincias } from '@/lib/supabase/queries/zones'
import { createPromo } from '../actions'
import PromoForm from '../PromoForm'

export default async function NewPromoPage() {
  const supabase = await createClient()
  const [marcas, provincias] = await Promise.all([
    getAllMarcas(supabase),
    getAllProvincias(supabase),
  ])

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/promos"
          className="text-xs underline hover:no-underline text-neutral-500"
        >
          ← Volver a Promos
        </Link>
        <h1 className="text-3xl font-black uppercase tracking-tight mt-2">
          Nueva promo
        </h1>
      </div>

      <PromoForm
        action={createPromo}
        marcas={marcas.map((m) => ({ id: m.id, name: m.name }))}
        provincias={provincias}
        submitLabel="Crear"
      />
    </div>
  )
}
