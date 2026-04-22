// @ts-nocheck
/**
 * app/(public)/constructoras/[slug]/page.tsx
 * Public constructora profile page.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPublicConstructoraBySlug } from '@/lib/supabase/queries/constructoras'
import { getPublishedModels } from '@/lib/supabase/queries/models'

interface ConstructoraPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ConstructoraPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const constructora = await getPublicConstructoraBySlug(supabase, slug)

  if (!constructora) return { title: 'Constructora no encontrada' }

  return {
    title: constructora.name,
    description: constructora.description ?? undefined,
  }
}

export default async function ConstructoraPage({ params }: ConstructoraPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const constructora = await getPublicConstructoraBySlug(supabase, slug)

  if (!constructora) notFound()

  const { data: models } = await getPublishedModels(
    supabase,
    {},
    { pageSize: 50 },
  )

  // Filter client-side for this constructora (avoids an extra query — replace
  // with a dedicated query if constructoras have many models)
  const ownModels = models.filter((m) => m.constructora_id === constructora.id)

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start gap-8 mb-16">
        {constructora.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={constructora.logo_url}
            alt={`Logo de ${constructora.name}`}
            className="w-20 h-20 object-contain border border-neutral-200 p-3"
          />
        )}
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tight">
            {constructora.name}
          </h1>
          {(constructora.city || constructora.province) && (
            <p className="text-neutral-500 mt-2">
              {[constructora.city, constructora.province]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          {constructora.description && (
            <p className="text-neutral-600 mt-4 max-w-2xl leading-relaxed">
              {constructora.description}
            </p>
          )}
          <div className="flex gap-4 mt-4 text-sm">
            {constructora.website_url && (
              <a
                href={constructora.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Sitio web
              </a>
            )}
            {constructora.phone && (
              <a
                href={`tel:${constructora.phone}`}
                className="underline hover:no-underline"
              >
                {constructora.phone}
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
        <p className="text-neutral-400">Esta constructora no tiene modelos publicados aún.</p>
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
