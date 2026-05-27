/**
 * app/admin/tipologias/new/page.tsx
 * Crear una tipología arquitectónica desde el panel admin.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { TipologiaForm } from '@/components/admin/TipologiaForm'
import { createTipologia } from '@/app/admin/tipologias/actions'

export default async function NewTipologiaPage() {
  const supabase = await createClient()
  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href="/admin/tipologias"
          className="hover:text-black transition-colors"
        >
          Tipologías
        </Link>
        <span>/</span>
        <span className="text-black">Nueva</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva tipología
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        El code y el ámbito (marca / global) se setean al crear y no se editan
        después — el catálogo público resuelve cada SKU por esa combinación.
      </p>

      <TipologiaForm
        action={createTipologia}
        marcas={approved}
        submitLabel="Crear"
      />
    </div>
  )
}
