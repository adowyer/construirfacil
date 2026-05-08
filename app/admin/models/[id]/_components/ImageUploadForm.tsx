'use client'

/**
 * app/admin/models/[id]/_components/ImageUploadForm.tsx
 *
 * Sube una imagen al modelo + popula `model_image_skus`. La categoría
 * (is_exterior + image_type) viene determinada por la tab activa del padre
 * (ImageGallery) — este componente NO tiene selector propio para evitar
 * inconsistencias.
 *
 * El usuario solo elige:
 *   - Variantes propias del style del modelo actual (chips V1/V2…).
 *   - Casas hermanas opcionales (otros style_names de la tipología).
 *   - El archivo + sort_order.
 */

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  uploadImage,
  type ActionResult,
} from '@/app/admin/models/[id]/image-actions'
import type { AdminTypologySku } from '@/lib/supabase/queries/admin_images'

type FormState = ActionResult | { ok: null }

interface ImageUploadFormProps {
  modelId: string
  linea: string
  tipologiaCode: string
  styleName: string | null
  variante: string | null
  sistemaConstructivo: string | null
  typologySkus: AdminTypologySku[]
  typologyHouses: string[]
  /** Categoría — viene fija desde la tab activa del padre. */
  isExterior: boolean
  imageType: 'render' | 'plano' | 'axo'
  /** Etiqueta visible para mostrar dónde se guarda la imagen. */
  categoryLabel: string
}

async function uploadAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return await uploadImage(formData)
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
    >
      {pending ? 'Subiendo…' : 'Subir imagen'}
    </button>
  )
}

export function ImageUploadForm({
  modelId,
  linea,
  tipologiaCode,
  styleName,
  variante,
  sistemaConstructivo,
  typologySkus,
  typologyHouses,
  isExterior,
  imageType,
  categoryLabel,
}: ImageUploadFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState<FormState, FormData>(
    uploadAction,
    { ok: null },
  )

  // SKUs del style actual (chips de variantes propias).
  const ownSkus = styleName ? typologySkus.filter((s) => s.style_name === styleName) : []
  // Casas hermanas (otros style_names en la misma tipología).
  const otherHouses = typologyHouses.filter((h) => h !== styleName)

  // Variantes propias seleccionadas. Default: la del SKU que el admin está
  // editando (matchea variante actual). Si no hay variante actual, todas.
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(() => {
    if (variante !== null && styleName !== null) {
      const sku = ownSkus.find((s) => s.variante === variante)
      return new Set(sku ? [sku.id] : ownSkus.map((s) => s.id))
    }
    return new Set(ownSkus.map((s) => s.id))
  })

  // Casas hermanas seleccionadas (style_names → todos sus SKUs se incluyen).
  const [selectedHouses, setSelectedHouses] = useState<Set<string>>(new Set())

  function toggleSku(skuId: string) {
    setSelectedSkuIds((cur) => {
      const next = new Set(cur)
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return next
    })
  }

  function toggleHouse(house: string) {
    setSelectedHouses((cur) => {
      const next = new Set(cur)
      if (next.has(house)) next.delete(house)
      else next.add(house)
      return next
    })
  }

  // Resolver lista final de house_catalog_ids (SKUs propios + SKUs de casas hermanas).
  function buildHouseCatalogIds(): string[] {
    const ids = new Set<string>(selectedSkuIds)
    for (const house of selectedHouses) {
      for (const sku of typologySkus) {
        if (sku.style_name === house) ids.add(sku.id)
      }
    }
    return Array.from(ids)
  }

  useEffect(() => {
    if (state.ok === true) {
      formRef.current?.reset()
      setSelectedHouses(new Set())
      router.refresh()
    }
  }, [state, router])

  const houseCatalogIds = buildHouseCatalogIds()

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-[#FAFAF7] border border-dashed border-neutral-300 rounded-xl p-6 space-y-5"
    >
      <input type="hidden" name="model_id" value={modelId} />
      <input type="hidden" name="linea" value={linea} />
      <input type="hidden" name="tipologia_code" value={tipologiaCode} />
      <input type="hidden" name="style_name" value={styleName ?? ''} />
      <input type="hidden" name="variante" value={variante ?? ''} />
      <input type="hidden" name="sistema_constructivo" value={sistemaConstructivo ?? ''} />
      <input type="hidden" name="is_exterior" value={isExterior ? 'true' : 'false'} />
      <input type="hidden" name="image_type" value={imageType} />
      <input
        type="hidden"
        name="house_catalog_ids"
        value={houseCatalogIds.join(',')}
      />

      <header className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-700">
          Subir imagen a{' '}
          <span className="text-[#ff003d]">{categoryLabel}</span>
        </h4>
        <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
          {imageType} · {isExterior ? 'exterior' : 'interior'}
        </span>
      </header>

      {state.ok === false && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}
      {state.ok === true && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          Imagen subida correctamente.
        </div>
      )}

      {/* Variantes propias */}
      {ownSkus.length > 0 && styleName && (
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
            Variantes de {styleName}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ownSkus.map((sku) => {
              const sel = selectedSkuIds.has(sku.id)
              return (
                <button
                  key={sku.id}
                  type="button"
                  onClick={() => toggleSku(sku.id)}
                  className={`text-[11px] uppercase tracking-widest px-[27px] py-[5px] rounded-full border transition-colors ${
                    sel
                      ? 'bg-[#ff003d] text-white border-[#ff003d]'
                      : 'bg-white text-neutral-700 border-[#E8E8E5] hover:border-[#ff003d] hover:text-[#ff003d]'
                  }`}
                  title={`${sku.sistema_constructivo} · ${sku.area_m2 ?? '—'} m²`}
                >
                  V{sku.variante}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Casas hermanas */}
      {otherHouses.length > 0 && (
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
            Aplica también a (opcional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {otherHouses.map((h) => {
              const sel = selectedHouses.has(h)
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHouse(h)}
                  className={`text-[11px] uppercase tracking-widest px-[27px] py-[5px] rounded-full border transition-colors ${
                    sel
                      ? 'bg-[#ff003d] text-white border-[#ff003d]'
                      : 'bg-white text-neutral-700 border-[#E8E8E5] hover:border-[#ff003d] hover:text-[#ff003d]'
                  }`}
                >
                  {sel ? '✓ ' : ''}
                  {h}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {/* File */}
        <div className="flex-1 min-w-[260px]">
          <label
            htmlFor="file"
            className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
          >
            Archivo *
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/*"
            required
            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-full file:border file:border-[#E8E8E5] file:bg-white file:text-xs file:uppercase file:tracking-widest file:font-semibold hover:file:border-[#ff003d] hover:file:text-[#ff003d] file:cursor-pointer"
          />
        </div>

        {/* Sort order */}
        <div className="w-24">
          <label
            htmlFor="sort_order"
            className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
          >
            Orden
          </label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            step="1"
            min="0"
            defaultValue={0}
            className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors"
          />
        </div>

        <SubmitButton />
      </div>

      <p className="text-[11px] text-neutral-400">
        Se va a linkear a {houseCatalogIds.length}{' '}
        {houseCatalogIds.length === 1 ? 'SKU' : 'SKUs'}.
      </p>
    </form>
  )
}
