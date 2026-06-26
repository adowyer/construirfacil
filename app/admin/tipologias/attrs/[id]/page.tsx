/**
 * app/admin/tipologias/attrs/[id]/page.tsx
 * Edit + delete de una fila de tipologia_attrs (4 ejes).
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getTipologiaAttrById,
  ATTR_EJE_LABEL,
} from '@/lib/supabase/queries/tipologia-attrs'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { TipologiaAttrForm } from '@/components/admin/TipologiaAttrForm'
import { DeleteTipologiaAttrButton } from '@/components/admin/DeleteTipologiaAttrButton'
import { updateTipologiaAttr } from '@/app/admin/tipologias/attrs/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTipologiaAttrPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const item = await getTipologiaAttrById(supabase, id)
  if (!item) notFound()

  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))
  const scopeLabel = item.marca_id
    ? `Propietario · ${marcas.find((m) => m.id === item.marca_id)?.name ?? 'marca'}`
    : 'Compartido'

  const updateAction = updateTipologiaAttr.bind(
    null,
    id,
    item.eje,
    item.valor,
    item.marca_id,
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href={`/admin/tipologias?eje=${item.eje}`}
          className="hover:text-black transition-colors"
        >
          Tipologías
        </Link>
        <span>/</span>
        <span className="hover:text-black transition-colors">
          {ATTR_EJE_LABEL[item.eje]}
        </span>
        <span>/</span>
        <span className="text-black">{item.valor}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            <span className="font-mono">{item.valor}</span>
            <span className="text-neutral-300 mx-2">·</span>
            <span className="font-normal">{item.nombre}</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            <span className="text-neutral-500">
              {ATTR_EJE_LABEL[item.eje]} · {scopeLabel}
            </span>
            {' · '}
            actualizado{' '}
            {new Date(item.updated_at).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <DeleteTipologiaAttrButton
          id={id}
          label={`${ATTR_EJE_LABEL[item.eje]} · ${item.valor}`}
        />
      </div>

      <TipologiaAttrForm
        action={updateAction}
        marcas={approved}
        defaultValues={item}
        isEdit
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
