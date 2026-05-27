/**
 * app/admin/marcas/[id]/zonas/new/page.tsx
 * Crear una nueva regla zonal para una marca.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMarcaById } from '@/lib/supabase/queries/marcas'
import { getAllProvincias } from '@/lib/supabase/queries/zones'
import { getLineasByMarca } from '@/lib/supabase/queries/lineas'
import { MarcaZonaForm } from '@/components/admin/MarcaZonaForm'
import { createMarcaZona } from '@/app/admin/marcas/[id]/zonas/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getScOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marcaId: string,
): Promise<string[]> {
  // SCs distintos usados por los modelos de la marca en el catálogo.
  const { data } = await supabase
    .from('house_catalog')
    .select('sistema_constructivo')
    .eq('marca_id', marcaId)
  const set = new Set<string>()
  for (const r of (data ?? []) as { sistema_constructivo: string | null }[]) {
    if (r.sistema_constructivo) set.add(r.sistema_constructivo)
  }
  return [...set].sort()
}

export default async function NewMarcaZonaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [marca, provincias, lineas, scOptions] = await Promise.all([
    getMarcaById(supabase, id),
    getAllProvincias(supabase),
    getLineasByMarca(supabase, id),
    getScOptions(supabase, id),
  ])

  if (!marca) notFound()

  const createAction = createMarcaZona.bind(null, id)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/marcas" className="hover:text-black transition-colors">
          Marcas
        </Link>
        <span>/</span>
        <Link
          href={`/admin/marcas/${id}`}
          className="hover:text-black transition-colors"
        >
          {marca.name}
        </Link>
        <span>/</span>
        <Link
          href={`/admin/marcas/${id}/zonas`}
          className="hover:text-black transition-colors"
        >
          Zonas
        </Link>
        <span>/</span>
        <span className="text-black">Nueva</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva regla zonal
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        El scope (provincia + línea + SC) se setea al crear y no se edita
        después — identifica la regla.
      </p>

      <MarcaZonaForm
        action={createAction}
        provincias={provincias}
        lineas={lineas.map((l) => ({ id: l.id, name: l.name }))}
        scOptions={scOptions}
        submitLabel="Crear regla"
      />
    </div>
  )
}
