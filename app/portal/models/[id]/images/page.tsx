// @ts-nocheck
/**
 * app/portal/models/[id]/images/page.tsx
 * Image and floor plan management for a house model.
 * (Stub — full uploader implementation follows once Storage bucket is configured.)
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'
import { getModelById } from '@/lib/supabase/queries/models'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ModelImagesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const constructora = await getMyConstructora(supabase, user.id)
  if (!constructora) redirect('/portal/onboarding')

  const model = await getModelById(supabase, id)
  if (!model || model.constructora_id !== constructora.id) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        {' / '}
        <Link href={`/portal/models/${model.id}`} className="hover:text-black transition-colors">
          {model.name}
        </Link>
        {' / '}
        <span className="text-black">Imágenes</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-8">
        Imágenes
      </h1>

      {/* Current images */}
      {model.images.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">
            Galería ({model.images.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {model.images.map((img) => (
              <div key={img.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.storage_url}
                  alt={img.alt_text || model.name}
                  className="w-full aspect-square object-cover border border-neutral-200"
                />
                {img.is_cover && (
                  <span className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-0.5">
                    Portada
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floor plans */}
      {model.floor_plans.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">
            Planos ({model.floor_plans.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {model.floor_plans.map((fp) => (
              <div key={fp.id}>
                {fp.label && (
                  <p className="text-xs text-neutral-400 mb-1">{fp.label}</p>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fp.storage_url}
                  alt={fp.label || model.name}
                  className="w-full border border-neutral-200"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload placeholder */}
      <div className="border border-dashed border-neutral-300 p-12 text-center">
        <p className="text-neutral-400 text-sm">
          El cargador de imágenes estará disponible una vez que el bucket de
          Storage de Supabase esté configurado.
        </p>
        <p className="text-xs text-neutral-300 mt-2">
          Ver comentarios en supabase/migrations/0001_initial_schema.sql
        </p>
      </div>
    </div>
  )
}
