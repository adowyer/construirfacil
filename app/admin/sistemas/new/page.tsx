/**
 * app/admin/sistemas/new/page.tsx
 * Crear contenido de un sistema constructivo desde el panel admin.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { SistemaConstructivoForm } from '@/components/admin/SistemaConstructivoForm'
import { createSistemaConstructivo } from '@/app/admin/sistemas/actions'

export default async function NewSistemaConstructivoPage() {
  const supabase = await createClient()
  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href="/admin/sistemas"
          className="hover:text-black transition-colors"
        >
          Sistemas constructivos
        </Link>
        <span>/</span>
        <span className="text-black">Nuevo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nuevo sistema constructivo
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        El sistema y el ámbito (marca / global) se setean al crear y no se
        editan después — el catálogo público resuelve la fila por esa
        combinación.
      </p>

      <SistemaConstructivoForm
        action={createSistemaConstructivo}
        marcas={approved}
        submitLabel="Crear"
      />
    </div>
  )
}
