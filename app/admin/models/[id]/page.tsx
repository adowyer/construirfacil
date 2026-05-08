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
import { ImageGallery } from '@/app/admin/models/[id]/_components/ImageGallery'
import { getModelImagesForGroup } from '@/lib/supabase/queries/admin_images'
import { AttributeSelector } from '@/components/admin/AttributeSelector'
import {
  BookOpen,
  Image as ImageIcon,
  ChevronRight,
  ListChecks,
} from 'lucide-react'

const MODEL_FORM_ID = 'model-edit-form'

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
  // Lee de model_image_skus (post-migración 0010). Trae todas las imágenes
  // linkeadas a cualquier SKU de la misma tipología + los SKUs hermanos
  // para los chips de variantes/casas hermanas en la galería.
  const linea: string | null = model.linea ?? null
  const tipologiaCode: string | null = model.tipologia_code ?? null
  const styleName: string | null = model.style_name ?? null
  const variante: string | null = model.variante ?? null
  const sistemaConstructivo: string | null = model.sistema_constructivo ?? null

  const galleryData =
    linea && tipologiaCode
      ? await getModelImagesForGroup(supabase, {
          linea,
          tipologia_code: tipologiaCode,
          style_name: styleName,
        })
      : { images: [], typology_skus: [], typology_houses: [], current_house_variants: [] }

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
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-400 uppercase tracking-widest mb-6">
        <Link href="/admin/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-black font-mono normal-case tracking-normal">
          {model.variant_code}
        </span>
      </div>

      <div className="flex items-start justify-between mb-10 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">{model.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
            {model.linea && (
              <span className="px-2.5 py-1 bg-[#ff003d]/10 text-[#ff003d] rounded-full uppercase tracking-[0.15em] text-[10px] font-bold">
                {model.linea}
              </span>
            )}
            {model.tipologia_code && (
              <span className="font-mono">T{model.tipologia_code}</span>
            )}
            {model.created_at && (
              <span>Creado el {formatDate(model.created_at)}</span>
            )}
          </div>
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
        formId={MODEL_FORM_ID}
        defaultValues={model}
        submitLabel="Guardar cambios"
      />

      {/* ── Contenido editorial (model_content) ─────────────────────────── */}
      <section className="mt-20">
        <header className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm">
            <BookOpen className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              Contenido editorial
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Una fila por (style_name, línea). Compartido entre todas las
              variantes del modelo bajo la misma línea.
            </p>
          </div>
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
      <section className="mt-20">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm">
              <ImageIcon className="w-[22px] h-[22px]" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                Imágenes
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                {linea ?? '—'} / T{tipologiaCode ?? '—'} /{' '}
                {styleName ?? '—'} / V{variante ?? '—'} /{' '}
                {sistemaConstructivo ?? '—'}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-mono">
            {galleryData.images.length}{' '}
            {galleryData.images.length === 1 ? 'imagen' : 'imágenes'}
          </span>
        </header>

        {!linea || !tipologiaCode ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
            Este modelo no tiene <code>linea</code> o <code>tipologia_code</code>{' '}
            asignados — completá esos campos antes de gestionar imágenes.
          </div>
        ) : (
          <ImageGallery
            modelId={id}
            linea={linea}
            tipologiaCode={tipologiaCode}
            currentStyleName={styleName}
            variante={variante}
            sistemaConstructivo={sistemaConstructivo}
            images={galleryData.images}
            typologySkus={galleryData.typology_skus}
            typologyHouses={galleryData.typology_houses}
          />
        )}
      </section>

      {/* ── Atributos (al final de la página, atado al form via form="…") ─ */}
      <section className="mt-20">
        <header className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm">
            <ListChecks className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              Atributos
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Equipamiento y propiedades del modelo. Se guardan junto con
              el form de arriba al hacer clic en &ldquo;Guardar cambios&rdquo;.
            </p>
          </div>
        </header>

        <div className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
          <AttributeSelector
            attributeTypes={attributeTypes}
            selectedValueIds={selectedAttributeValueIds}
            formId={MODEL_FORM_ID}
          />
        </div>
      </section>
    </div>
  )
}
