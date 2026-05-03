/**
 * app/admin/models/[id]/page.tsx
 * Edit a house_catalog entry. Also exposes permanent delete.
 * Below the edit form, renders an image-management section that operates
 * on the `model_images` table for this model's (linea, tipologia_code,
 * style_name) group.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getModelById, getModelContent } from '@/lib/supabase/queries/models'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import {
  getAttributeTypesWithValues,
  getAttributesForCatalog,
} from '@/lib/supabase/queries/attributes'
import { ModelForm } from '@/components/admin/ModelForm'
import { ModelContentForm } from '@/components/admin/ModelContentForm'
import { DeleteModelButton } from '@/components/admin/DeleteModelButton'
import { updateModel } from '@/app/admin/models/actions'
import { saveModelContent } from '@/app/admin/models/[id]/content-actions'
import {
  ImageGallery,
  type GalleryImage,
} from '@/app/admin/models/[id]/_components/ImageGallery'
import { ImageUploadForm } from '@/app/admin/models/[id]/_components/ImageUploadForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditModelPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [model, marcas, lineas, attributeTypes, selectedAttributeValueIds] =
    await Promise.all([
      getModelById(supabase, id),
      getAllMarcas(supabase),
      getAllLineas(supabase),
      getAttributeTypesWithValues(supabase),
      getAttributesForCatalog(supabase, id),
    ])
  if (!model) notFound()

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

  // ── Image gallery data ────────────────────────────────────────────────────
  // Match en 3 niveles de "scope":
  //   • Específica de variante: (linea, tipologia, style, variante)
  //   • Compartida del modelo:  (linea, tipologia, style, variante NULL)
  //   • Compartida tipología:   (linea, tipologia, style NULL, variante NULL)
  // sistema_constructivo se ignora — Drive no separa por sistema.
  const linea: string | null = model.linea ?? null
  const tipologiaCode: string | null = model.tipologia_code ?? null
  const styleName: string | null = model.style_name ?? null
  const variante: string | null = model.variante ?? null
  const sistemaConstructivo: string | null = model.sistema_constructivo ?? null

  let images: GalleryImage[] = []
  let galleryError: string | null = null

  if (linea && tipologiaCode) {
    // Construir el filtro OR con condiciones agrupadas (PostgREST `or=and(...)`).
    const orConditions: string[] = []
    if (styleName === null) {
      // Modelo sin style: solo nivel tipología.
      orConditions.push('and(style_name.is.null,variante.is.null)')
    } else {
      if (variante !== null) {
        orConditions.push(
          `and(style_name.eq.${styleName},variante.eq.${variante})`,
        )
      }
      orConditions.push(`and(style_name.eq.${styleName},variante.is.null)`)
      orConditions.push('and(style_name.is.null,variante.is.null)')
    }

    const { data, error: imgErr } = await supabase
      .from('model_images')
      .select(
        'id, storage_url, storage_path, is_cover, is_exterior, image_type, sort_order, status, style_name, variante',
      )
      .eq('linea', linea)
      .eq('tipologia_code', tipologiaCode)
      .neq('status', 'archived')
      .or(orConditions.join(','))
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })

    if (imgErr) {
      galleryError = imgErr.message
    } else {
      images = (data ?? []) as GalleryImage[]
    }
  }

  // ── Editorial content (model_content) — keyed por (style_name, linea) ─────
  const modelContent =
    styleName && linea
      ? await getModelContent(supabase, styleName, linea)
      : null
  const saveContentAction = saveModelContent.bind(
    null,
    styleName ?? '',
    linea ?? '',
    id,
  )

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
        marcas={marcas.map((m) => ({ id: m.id, name: m.name }))}
        lineas={lineas.map((l) => ({
          id: l.id,
          marca_id: l.marca_id,
          name: l.name,
          sort_order: l.sort_order,
        }))}
        attributeTypes={attributeTypes}
        selectedAttributeValueIds={selectedAttributeValueIds}
        defaultValues={model}
        submitLabel="Guardar cambios"
      />

      {/* ── Contenido editorial (model_content) ─────────────────────────── */}
      <section className="mt-16">
        <header className="mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight">
            Contenido editorial
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Una fila por (style_name, línea). Compartido entre todas las
            variantes del modelo bajo la misma línea.
          </p>
        </header>

        {!styleName || !linea ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
            Este modelo no tiene <code>style_name</code> o <code>linea</code>{' '}
            asignados — completá esos campos en el form de arriba antes de
            cargar contenido editorial.
          </div>
        ) : (
          <ModelContentForm
            action={saveContentAction}
            styleName={styleName}
            linea={linea}
            defaultValues={modelContent}
          />
        )}
      </section>

      {/* ── Image management ────────────────────────────────────────────── */}
      <section className="mt-16">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              Imágenes
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Modelo:{' '}
              <span className="font-mono text-neutral-600">
                {linea ?? '—'} / T{tipologiaCode ?? '—'} /{' '}
                {styleName ?? '—'} / V{variante ?? '—'} /{' '}
                {sistemaConstructivo ?? '—'}
              </span>
            </p>
          </div>
          <span className="text-[11px] text-neutral-400 uppercase tracking-widest">
            {images.length} {images.length === 1 ? 'imagen' : 'imágenes'}
          </span>
        </header>

        {!linea || !tipologiaCode ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
            Este modelo no tiene <code>linea</code> o <code>tipologia_code</code>{' '}
            asignados — completá esos campos antes de gestionar imágenes.
          </div>
        ) : (
          <>
            {galleryError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                Error al cargar imágenes: {galleryError}
              </div>
            )}

            <ImageGallery
              modelId={id}
              linea={linea}
              tipologiaCode={tipologiaCode}
              styleName={styleName}
              variante={variante}
              sistemaConstructivo={sistemaConstructivo}
              images={images}
            />

            <div className="mt-8">
              <h3 className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
                Subir nueva imagen
              </h3>
              <ImageUploadForm
                modelId={id}
                linea={linea}
                tipologiaCode={tipologiaCode}
                styleName={styleName}
                variante={variante}
                sistemaConstructivo={sistemaConstructivo}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
