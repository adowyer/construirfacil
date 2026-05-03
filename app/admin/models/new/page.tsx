/**
 * app/admin/models/new/page.tsx
 * Crear una nueva entrada en `house_catalog`.
 */

import Link from 'next/link'
import { ModelForm } from '@/components/admin/ModelForm'
import { createModel } from '@/app/admin/models/actions'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import { getAttributeTypesWithValues } from '@/lib/supabase/queries/attributes'

export default async function NewModelPage() {
  const supabase = await createClient()

  const [marcas, lineas, attributeTypes] = await Promise.all([
    getAllMarcas(supabase),
    getAllLineas(supabase),
    getAttributeTypesWithValues(supabase),
  ])

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        <span>/</span>
        <span className="text-black">Nuevo modelo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Nuevo modelo
      </h1>

      <ModelForm
        action={createModel}
        marcas={marcas.map((m) => ({ id: m.id, name: m.name }))}
        lineas={lineas.map((l) => ({
          id: l.id,
          marca_id: l.marca_id,
          name: l.name,
          sort_order: l.sort_order,
        }))}
        attributeTypes={attributeTypes}
        submitLabel="Crear modelo"
      />
    </div>
  )
}
