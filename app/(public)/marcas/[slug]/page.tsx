// @ts-nocheck
/**
 * app/(public)/marcas/[slug]/page.tsx
 * Public marca profile page.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPublicMarcaBySlug } from '@/lib/supabase/queries/marcas'
import { getPublishedModels } from '@/lib/supabase/queries/models'

interface MarcaPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: MarcaPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const marca = await getPublicMarcaBySlug(supabase, slug)

  if (!marca) return { title: 'Marca no encontrada' }

  return {
    title: marca.name,
    description: marca.description ?? undefined,
  }
}

export default async function MarcaPage({ params }: MarcaPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const marca = await getPublicMarcaBySlug(supabase, slug)

  if (!marca) notFound()

  const { data: models } = await getPublishedModels(
    supabase,
    {},
    { pageSize: 50 },
  )

  // Filter client-side for this marca (avoids an extra query — replace
  // with a dedicated query if marcas have many models)
  const ownModels = models.filter((m) => m.marca_id === marca.id)

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start gap-8 mb-16">
        {marca.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={marca.logo_url}
            alt={`Logo de ${marca.name}`}
            className="w-20 h-20 object-contain border border-neutral-200 p-3"
          />
        )}
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tight">
            {marca.name}
          </h1>
          {(marca.city || marca.province) && (
            <p className="text-neutral-500 mt-2">
              {[marca.city, marca.province]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          {marca.description && (
            <p className="text-neutral-600 mt-4 max-w-2xl leading-relaxed">
              {marca.description}
            </p>
          )}
          <div className="flex gap-4 mt-4 text-sm">
            {marca.website_url && (
              <a
                href={marca.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Sitio web
              </a>
            )}
            {marca.phone && (
              <a
                href={`tel:${marca.phone}`}
                className="underline hover:no-underline"
              >
                {marca.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Models */}
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-8 border-t border-neutral-200 pt-8">
        Modelos ({ownModels.length})
      </h2>

      {ownModels.length === 0 ? (
        <p className="text-neutral-400">Esta marca no tiene modelos publicados aún.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ownModels.map((model) => (
            <a
              key={model.id}
              href={`/models/${model.slug}`}
              className="block border border-neutral-200 hover:border-black transition-colors group"
            >
              {model.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={model.cover_image.storage_url}
                  alt={model.cover_image.alt_text}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold group-hover:underline">{model.name}</h3>
                <div className="mt-3 flex gap-4 text-sm text-neutral-600">
                  <span>{model.bedrooms} dorm.</span>
                  <span>{model.total_area_m2} m²</span>
                  {model.price_from_usd && (
                    <span className="ml-auto font-semibold">
                      USD {model.price_from_usd.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
