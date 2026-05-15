/**
 * app/admin/brand/[id]/page.tsx
 * Edit + delete de un brand_content.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBrandContentById } from '@/lib/supabase/queries/brand-content'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { BrandContentForm } from '@/components/admin/BrandContentForm'
import { DeleteBrandContentButton } from '@/components/admin/DeleteBrandContentButton'
import { updateBrandContent } from '@/app/admin/brand/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBrandContentPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const item = await getBrandContentById(supabase, id)
  if (!item) notFound()

  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))

  const updateAction = updateBrandContent.bind(
    null,
    id,
    item.key,
    item.marca_id,
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/brand" className="hover:text-black transition-colors">
          Contenido del sitio
        </Link>
        <span>/</span>
        <span className="text-black">{item.label}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {item.label}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            key <code className="text-neutral-500">{item.key}</code>
            {' · '}
            actualizado{' '}
            {new Date(item.updated_at).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <DeleteBrandContentButton id={id} name={item.label} />
      </div>

      <BrandContentForm
        action={updateAction}
        marcas={approved}
        defaultValues={item}
        isEdit
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
