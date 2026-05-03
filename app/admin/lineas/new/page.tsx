/**
 * app/admin/lineas/new/page.tsx
 * Crear una nueva línea desde el panel admin.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { LineaForm } from '@/components/admin/LineaForm'
import { createLinea } from '@/app/admin/lineas/actions'

interface PageProps {
  searchParams: Promise<{ marca?: string }>
}

export default async function NewLineaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const [marcas, sp] = await Promise.all([getAllMarcas(supabase), searchParams])

  // Solo ofrecemos marcas aprobadas en el select de creación.
  const approved = marcas.filter((m) => m.status === 'approved')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/lineas" className="hover:text-black transition-colors">
          Líneas
        </Link>
        <span>/</span>
        <span className="text-black">Nueva línea</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Nueva línea
      </h1>

      {approved.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
          No hay marcas aprobadas todavía.{' '}
          <Link href="/admin/marcas/new" className="underline">
            Creá una marca primero
          </Link>
          .
        </div>
      ) : (
        <LineaForm
          action={createLinea}
          marcas={approved}
          defaultMarcaId={sp?.marca}
          submitLabel="Crear línea"
        />
      )}
    </div>
  )
}
