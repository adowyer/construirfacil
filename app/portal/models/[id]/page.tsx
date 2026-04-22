// @ts-nocheck
/**
 * app/portal/models/[id]/page.tsx
 * Edit an existing house model.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'
import { getModelById } from '@/lib/supabase/queries/models'
import { getConstructionSystems, getAttributeTypesWithValues } from '@/lib/supabase/queries/attributes'
import ModelForm from '@/components/portal/ModelForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditModelPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const constructora = await getMyConstructora(supabase, user.id)
  if (!constructora) redirect('/portal/onboarding')

  const [model, constructionSystems, attributeTypes] = await Promise.all([
    getModelById(supabase, id),
    getConstructionSystems(supabase),
    getAttributeTypesWithValues(supabase),
  ])

  if (!model || model.constructora_id !== constructora.id) notFound()

  // Selected attribute value IDs
  const selectedAttributeValueIds = model.attributes.map(
    (a) => a.attribute_value.id,
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        {' / '}
        <span className="text-black">{model.name}</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        {model.name}
      </h1>

      {model.status === 'rejected' && model.rejection_reason && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 mb-8 text-sm text-red-700">
          Rechazado: {model.rejection_reason}
        </div>
      )}

      <div className="mb-8">
        <Link
          href={`/portal/models/${model.id}/images`}
          className="text-sm underline hover:no-underline text-neutral-500"
        >
          Gestionar imágenes ({model.images.length})
        </Link>
      </div>

      <ModelForm
        constructoraId={constructora.id}
        constructionSystems={constructionSystems}
        attributeTypes={attributeTypes}
        model={model}
        selectedAttributeValueIds={selectedAttributeValueIds}
      />
    </div>
  )
}
