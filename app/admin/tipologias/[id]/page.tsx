/**
 * app/admin/tipologias/[id]/page.tsx
 * Edit + delete de una fila de tipologia_catalog.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTipologiaById } from '@/lib/supabase/queries/tipologia'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { TipologiaForm } from '@/components/admin/TipologiaForm'
import { DeleteTipologiaButton } from '@/components/admin/DeleteTipologiaButton'
import { updateTipologia } from '@/app/admin/tipologias/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTipologiaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const item = await getTipologiaById(supabase, id)
  if (!item) notFound()

  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))
  const scopeLabel = item.marca_id
    ? `Propietario · ${marcas.find((m) => m.id === item.marca_id)?.name ?? 'marca'}`
    : 'Compartido'

  const updateAction = updateTipologia.bind(
    null,
    id,
    item.code,
    item.marca_id,
  )

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
        <span className="text-black">{item.code}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            <span className="font-mono">{item.code}</span>
            <span className="text-neutral-300 mx-2">·</span>
            <span className="font-normal">{item.nombre}</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            <span className="text-neutral-500">{scopeLabel}</span>
            {' · '}
            actualizado{' '}
            {new Date(item.updated_at).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <DeleteTipologiaButton id={id} code={item.code} />
      </div>

      <TipologiaForm
        action={updateAction}
        marcas={approved}
        defaultValues={item}
        isEdit
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
