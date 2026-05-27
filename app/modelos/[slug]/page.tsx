/**
 * app/modelos/[slug]/page.tsx
 *
 * Deep-link a un modelo del catálogo via slug canónico `casa-<tipo>-<style>`
 * (ej. `/modelos/casa-nodo-pampa`). Server component que:
 *
 *   1. Carga el mismo bag que `/` (loadHomeData) — mismo CatalogPage.
 *   2. Resuelve el slug contra los modelos para 404 temprano (no se renderean
 *      catálogos rotos por slugs inexistentes).
 *   3. Genera <metadata> con el display_name + cover_url del modelo para
 *      share/SEO.
 *   4. Renderea CatalogPage con `initialModelSlug={slug}` → la página arranca
 *      en modo catálogo y abre el station-overlay del modelo en mount.
 *
 * Intercepting Routes (preservar la URL al expandir desde el catálogo) queda
 * como refinamiento posterior — requiere parallel routes en app/layout.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadHomeData } from '@/lib/content/home-data'
import CatalogPage from '@/components/catalog/CatalogPage'
import { modelGroupSlug } from '@/lib/content/model-slug'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function findModel(slug: string) {
  const supabase = await createClient()
  const data = await loadHomeData(supabase)
  const model = data.models.find(
    (m) =>
      modelGroupSlug({
        style_name: m.style_name,
        tipologia_code_new: m.tipologia_code_new,
      }) === slug,
  )
  return { data, model }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { model } = await findModel(slug)
  if (!model) {
    return { title: 'Modelo no encontrado' }
  }
  const title = `${model.display_name} — ConstruirFácil`
  const desc =
    model.concept_blurb ??
    `Modelo ${model.display_name} ${
      model.area_min ? `desde ${Math.round(model.area_min)} m²` : ''
    }${model.beds_min ? ` · ${model.beds_min} dorm.` : ''}.`
  return {
    title,
    description: desc.trim(),
    openGraph: {
      title,
      description: desc.trim(),
      images: model.cover_url ? [{ url: model.cover_url }] : undefined,
    },
  }
}

export default async function ModeloPage({ params }: PageProps) {
  const { slug } = await params
  const { data, model } = await findModel(slug)
  if (!model) notFound()

  return (
    <CatalogPage
      {...data}
      selectedMarca={null}
      initialHomeMode={false}
      initialModelSlug={slug}
    />
  )
}
