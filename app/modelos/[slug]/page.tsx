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
import ModelGateClient from '@/components/auth/ModelGateClient'
import { currentClientEmail } from '@/lib/auth/get-current-client'

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
  // Buscar el modelo PRIMERO: si no existe, 404 limpio (no gate roto con
  // "Modelo no encontrado" detrás). Si existe, podemos enriquecer el gate
  // con un teaser de la casa concreta — el visitante que llega de un
  // anuncio entiende QUÉ está bloqueado.
  const { data, model } = await findModel(slug)
  if (!model) notFound()

  const clientEmail = await currentClientEmail()
  if (!clientEmail) {
    const areaLabel = model.area_min ? `${Math.round(model.area_min)} m²` : null
    const bedsLabel = model.beds_min ? `${model.beds_min} dorm.` : null
    const metaLine = [areaLabel, bedsLabel].filter(Boolean).join(' · ')
    return (
      <div className="cf-model-gate-wrap">
        <div className="cf-model-gate-teaser" aria-hidden="true">
          {model.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={model.cover_url}
              alt=""
              className="cf-model-gate-teaser-img"
            />
          )}
          <div className="cf-model-gate-teaser-meta">
            <p className="cf-model-gate-teaser-eyebrow">Modelo del catálogo</p>
            <h1 className="cf-model-gate-teaser-title">{model.display_name}</h1>
            {metaLine && (
              <p className="cf-model-gate-teaser-line">{metaLine}</p>
            )}
            {model.concept_blurb && (
              <p className="cf-model-gate-teaser-blurb">{model.concept_blurb}</p>
            )}
          </div>
        </div>
        <ModelGateClient modelName={model.display_name} />
      </div>
    )
  }

  return (
    <CatalogPage
      {...data}
      selectedMarca={null}
      initialHomeMode={false}
      initialModelSlug={slug}
    />
  )
}
