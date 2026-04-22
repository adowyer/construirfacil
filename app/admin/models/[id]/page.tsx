/**
 * app/admin/models/[id]/page.tsx
 * Edit a house_catalog entry. Also exposes permanent delete.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ModelForm } from '@/components/admin/ModelForm'
import { DeleteModelButton } from '@/components/admin/DeleteModelButton'
import { updateModel } from '@/app/admin/models/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditModelPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: model, error } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !model) notFound()

  // Bind the id into the Server Action so the form only receives (prevState, formData)
  const updateModelWithId = updateModel.bind(null, id)

  function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        <span>/</span>
        <span className="text-black">{model.variant_code}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{model.name}</h1>
          {model.created_at && (
            <p className="text-xs text-neutral-400 mt-1">
              Creado el {formatDate(model.created_at)}
            </p>
          )}
        </div>

        {/* Danger zone */}
        <DeleteModelButton id={id} />
      </div>

      <ModelForm
        action={updateModelWithId}
        defaultValues={model}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
