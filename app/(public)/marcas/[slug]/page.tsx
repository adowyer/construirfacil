// @ts-nocheck
/**
 * app/(public)/marcas/[slug]/page.tsx
 *
 * Página pública de marca. Dos caminos:
 *
 *  1. **Landing rica** — si la marca tiene entry en
 *     lib/content/marca-landing/registry.ts, renderiza la landing
 *     editorial completa (hero, manifiesto, sistema, soluciones,
 *     líneas, modelos destacados, cierre).
 *
 *  2. **Fallback simple** — si la marca existe pero no tiene
 *     contenido editorial cargado, muestra un placeholder con logo,
 *     nombre, descripción y link al catálogo. Sin cargar modelos
 *     (esto evita el bug histórico con shapes incompatibles y
 *     mantiene el fallback liviano hasta que cada marca tenga su
 *     propio catálogo).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPublicMarcaBySlug } from '@/lib/supabase/queries/marcas'
import { getFeaturedModels } from '@/lib/supabase/queries/featured'
import { getMarcaLandingContent } from '@/lib/content/marca-landing/registry'
import MarcaLanding from '@/components/marca-landing/MarcaLanding'

interface MarcaPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: MarcaPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const marca = await getPublicMarcaBySlug(supabase, slug)

  if (!marca) return { title: 'Marca no encontrada' }

  const content = getMarcaLandingContent(slug)
  const description =
    content?.hero?.subheadline ?? marca.description ?? undefined

  return {
    title: `${marca.name} — ConstruirFácil`,
    description,
  }
}

export default async function MarcaPage({ params }: MarcaPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const marca = await getPublicMarcaBySlug(supabase, slug)

  if (!marca) notFound()

  const content = getMarcaLandingContent(slug)

  // ── Path 1: landing rica ────────────────────────────────────────────────
  if (content) {
    // Hoy `getFeaturedModels` no filtra por marca_id (CatalogModel no expone
    // el campo). Como Hausind es la única marca con catálogo poblado, los
    // featured globales = featured de Hausind. Cuando llegue una segunda
    // marca con featured propios, extender featured.ts con un parámetro
    // `marcaId`.
    const featuredModels = await getFeaturedModels(supabase, 6)

    return (
      <MarcaLanding
        marca={marca}
        content={content}
        featuredModels={featuredModels}
      />
    )
  }

  // ── Path 2: fallback simple para marcas sin contenido editorial ─────────
  return (
    <main className="max-w-3xl mx-auto px-6 py-24">
      <div className="flex items-start gap-8 mb-12">
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
              {[marca.city, marca.province].filter(Boolean).join(', ')}
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

      <div className="border-t border-neutral-200 pt-12">
        <p className="text-neutral-400 text-sm">
          Esta marca todavía no tiene contenido editorial publicado.
        </p>
        <a
          href="/"
          className="inline-block mt-6 underline hover:no-underline"
        >
          Ver el catálogo completo →
        </a>
      </div>
    </main>
  )
}
