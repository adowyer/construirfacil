/**
 * app/admin/sistemas/[id]/page.tsx
 * Edit + foto + delete de una fila de sistema_constructivo_content.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getSistemaConstructivoById,
} from '@/lib/supabase/queries/sistema-constructivo'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { SistemaConstructivoForm } from '@/components/admin/SistemaConstructivoForm'
import { ScImageUploader } from '@/components/admin/ScImageUploader'
import { DeleteSistemaConstructivoButton } from '@/components/admin/DeleteSistemaConstructivoButton'
import { updateSistemaConstructivo } from '@/app/admin/sistemas/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditSistemaConstructivoPage({
  params,
}: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const item = await getSistemaConstructivoById(supabase, id)
  if (!item) notFound()

  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))
  const scopeLabel = item.marca_id
    ? `Propietario · ${marcas.find((m) => m.id === item.marca_id)?.name ?? 'marca'}`
    : 'Compartido'

  const updateAction = updateSistemaConstructivo.bind(
    null,
    id,
    item.slug,
    item.marca_id,
  )

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
        <span className="text-black">{item.name}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {item.name}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            slug <code className="text-neutral-500">{item.slug}</code>
            {' · '}
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

        <DeleteSistemaConstructivoButton id={id} name={item.name} />
      </div>

      <div className="mb-8">
        <ScImageUploader
          scId={id}
          scName={item.name}
          initialImageUrl={item.hero_image_url}
        />
      </div>

      <SistemaConstructivoForm
        action={updateAction}
        marcas={approved}
        defaultValues={item}
        isEdit
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
