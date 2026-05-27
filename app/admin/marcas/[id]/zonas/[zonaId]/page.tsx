/**
 * app/admin/marcas/[id]/zonas/[zonaId]/page.tsx
 * Edit + delete de una regla zonal.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMarcaById } from '@/lib/supabase/queries/marcas'
import {
  getAllProvincias,
  getMarcaZonaById,
} from '@/lib/supabase/queries/zones'
import { getLineasByMarca } from '@/lib/supabase/queries/lineas'
import { MarcaZonaForm } from '@/components/admin/MarcaZonaForm'
import { DeleteMarcaZonaButton } from '@/components/admin/DeleteMarcaZonaButton'
import { updateMarcaZona } from '@/app/admin/marcas/[id]/zonas/actions'

interface PageProps {
  params: Promise<{ id: string; zonaId: string }>
}

async function getScOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marcaId: string,
): Promise<string[]> {
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

export default async function EditMarcaZonaPage({ params }: PageProps) {
  const { id, zonaId } = await params
  const supabase = await createClient()

  const [marca, rule, provincias, lineas, scOptions] = await Promise.all([
    getMarcaById(supabase, id),
    getMarcaZonaById(supabase, zonaId),
    getAllProvincias(supabase),
    getLineasByMarca(supabase, id),
    getScOptions(supabase, id),
  ])

  if (!marca || !rule || rule.marca_id !== id) notFound()

  const provName =
    provincias.find((p) => p.id === rule.provincia_id)?.name ?? '—'
  const lineaName = rule.linea_id
    ? lineas.find((l) => l.id === rule.linea_id)?.name ?? '—'
    : 'Todas las líneas'
  const scName = rule.sistema_constructivo ?? 'Todos los SCs'

  const updateAction = updateMarcaZona.bind(null, id, zonaId, {
    provincia_id: rule.provincia_id,
    linea_id: rule.linea_id,
    sistema_constructivo: rule.sistema_constructivo,
  })

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
        <span className="text-black">{provName}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {provName}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            <span className="text-neutral-500">{lineaName}</span>
            {' · '}
            <span className="text-neutral-500">{scName}</span>
          </p>
        </div>
        <DeleteMarcaZonaButton
          marcaId={id}
          id={zonaId}
          description={`${provName} · ${lineaName} · ${scName}`}
        />
      </div>

      <MarcaZonaForm
        action={updateAction}
        provincias={provincias}
        lineas={lineas.map((l) => ({ id: l.id, name: l.name }))}
        scOptions={scOptions}
        defaultValues={rule}
        isEdit
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
