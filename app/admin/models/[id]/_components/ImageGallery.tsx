'use client'

/**
 * app/admin/models/[id]/_components/ImageGallery.tsx
 *
 * Galería del admin con tabs por categoría y chips de variantes / casas
 * hermanas. Lee de `model_image_skus` (vía la query helper
 * `getModelImagesForGroup`) — la fuente de verdad post-migración 0010.
 *
 * Tabs:
 *   - Exterior      → is_exterior=true,  image_type='render'
 *   - Interior      → is_exterior=false, image_type='render'
 *   - Planos        → image_type='plano'
 *   - Axonometrías  → image_type='axo'
 *
 * Por imagen:
 *   - Chips de variantes (V1, V2…) del style_name actual del modelo →
 *     toggle linkea/desvincula esa imagen al SKU correspondiente.
 *   - Chips de casas hermanas (style_names de la misma tipología) →
 *     toggle aplica la imagen a TODOS los SKUs de esa casa (todas sus
 *     variantes) o ninguno.
 *   - Marcar como portada, archivar (igual que antes).
 *
 * Cada acción persiste vía server actions y luego llama a router.refresh()
 * para resincronizar la UI con la DB.
 */

import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveImage,
  setCoverImage,
  setImageSkuLinks,
  type ActionResult,
} from '@/app/admin/models/[id]/image-actions'
import type {
  AdminGalleryImage,
  AdminTypologySku,
} from '@/lib/supabase/queries/admin_images'
import { ImageUploadForm } from './ImageUploadForm'

// ---------------------------------------------------------------------------
// Tabs — cada uno define is_exterior + image_type. El upload form dentro
// del panel hereda esos valores automáticamente (no hay selector duplicado).
// ---------------------------------------------------------------------------

type TabId = 'exterior' | 'interior' | 'planos' | 'axo'

const TABS: {
  id: TabId
  label: string
  isExterior: boolean
  imageType: 'render' | 'plano' | 'axo'
}[] = [
    { id: 'exterior', label: 'Exterior', isExterior: true, imageType: 'render' },
    { id: 'interior', label: 'Interior', isExterior: false, imageType: 'render' },
    { id: 'planos', label: 'Planos', isExterior: false, imageType: 'plano' },
    { id: 'axo', label: 'Axonometrías', isExterior: false, imageType: 'axo' },
  ]

function imageInTab(img: AdminGalleryImage, tab: TabId): boolean {
  switch (tab) {
    case 'exterior':
      return img.is_exterior === true && img.image_type === 'render'
    case 'interior':
      return img.is_exterior === false && img.image_type === 'render'
    case 'planos':
      return img.image_type === 'plano'
    case 'axo':
      return img.image_type === 'axo'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImageGalleryProps {
  modelId: string
  linea: string
  tipologiaCode: string
  /** Style del modelo actual. Usado para chips de variantes propias. */
  currentStyleName: string | null
  /** Variante del SKU actual del admin (para default del upload form). */
  variante: string | null
  /** Sistema constructivo del SKU actual (hidden input del upload). */
  sistemaConstructivo: string | null
  images: AdminGalleryImage[]
  typologySkus: AdminTypologySku[]
  /** Style_names únicos de la tipología (para chips de casas hermanas). */
  typologyHouses: string[]
  showArchived?: boolean
}

export function ImageGallery({
  modelId,
  linea,
  tipologiaCode,
  currentStyleName,
  variante,
  sistemaConstructivo,
  images,
  typologySkus,
  typologyHouses,
  showArchived = false,
}: ImageGalleryProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('exterior')

  // Index: house_catalog.id → AdminTypologySku
  const skuById = useMemo(() => {
    const m = new Map<string, AdminTypologySku>()
    for (const s of typologySkus) m.set(s.id, s)
    return m
  }, [typologySkus])

  // Index: style_name → SKUs de esa casa.
  const skusByStyle = useMemo(() => {
    const m = new Map<string, AdminTypologySku[]>()
    for (const s of typologySkus) {
      const arr = m.get(s.style_name) ?? []
      arr.push(s)
      m.set(s.style_name, arr)
    }
    return m
  }, [typologySkus])

  function handleResult(imageId: string, result: ActionResult) {
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [imageId]: result.error }))
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[imageId]
        return next
      })
      router.refresh()
    }
    setBusyId(null)
  }

  function runAction(imageId: string, fn: () => Promise<ActionResult>) {
    setBusyId(imageId)
    startTransition(async () => {
      const result = await fn()
      handleResult(imageId, result)
    })
  }

  function handleSetCover(image: AdminGalleryImage) {
    runAction(image.id, () =>
      setCoverImage(image.id, { linea, tipologiaCode }, modelId),
    )
  }

  function handleArchive(image: AdminGalleryImage) {
    if (!confirm('¿Archivar esta imagen? Quedará oculta del catálogo público pero se puede restaurar luego.')) return
    runAction(image.id, () => archiveImage(image.id, modelId))
  }

  /** Toggle un SKU en los links de la imagen. */
  function handleToggleSku(image: AdminGalleryImage, skuId: string) {
    const current = new Set(image.linked_sku_ids)
    if (current.has(skuId)) current.delete(skuId)
    else current.add(skuId)
    runAction(image.id, () =>
      setImageSkuLinks(image.id, Array.from(current), modelId),
    )
  }

  /** Toggle una casa hermana entera (todos sus SKUs) en los links. */
  function handleToggleHouse(image: AdminGalleryImage, styleName: string) {
    const houseSkus = skusByStyle.get(styleName) ?? []
    const houseSkuIds = houseSkus.map((s) => s.id)
    const current = new Set(image.linked_sku_ids)
    const allLinked = houseSkuIds.every((id) => current.has(id))
    if (allLinked) {
      // Si los tiene todos, los saca a todos.
      for (const id of houseSkuIds) current.delete(id)
    } else {
      // Si no los tiene todos, los agrega a todos.
      for (const id of houseSkuIds) current.add(id)
    }
    runAction(image.id, () =>
      setImageSkuLinks(image.id, Array.from(current), modelId),
    )
  }

  // Filtrar por tab + archivadas.
  const filtered = images.filter((img) => {
    if (!showArchived && img.status === 'archived') return false
    return imageInTab(img, activeTab)
  })

  // Counts para mostrar en cada tab.
  const counts: Record<TabId, number> = useMemo(() => {
    const out: Record<TabId, number> = { exterior: 0, interior: 0, planos: 0, axo: 0 }
    for (const img of images) {
      if (!showArchived && img.status === 'archived') continue
      for (const tab of TABS) {
        if (imageInTab(img, tab.id)) out[tab.id]++
      }
    }
    return out
  }, [images, showArchived])

  // Variantes del style actual (chips primarios, arriba).
  const ownVariants = currentStyleName
    ? (skusByStyle.get(currentStyleName) ?? [])
    : []
  // Otras casas (chips secundarios, abajo).
  const otherHouses = typologyHouses.filter((h) => h !== currentStyleName)

  // Configuración de la tab activa (is_exterior + image_type para el upload).
  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div>
      {/* ── Tabs estilo "folder" — sobresalen del panel y se conectan ── */}
      <div className="flex flex-wrap gap-1 px-2 relative z-10">
        {TABS.map((t) => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative px-[27px] py-[5px] text-xs uppercase tracking-widest font-bold rounded-t-2xl transition-all flex items-center gap-2.5 border-2 ${isActive
                ? 'bg-white border-[#E8E8E5] border-b-white text-[#ff003d] -mb-[2px] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]'
                : 'bg-neutral-100 border-transparent text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 mt-2'
                }`}
            >
              {t.label}
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums min-w-[22px] text-center ${isActive
                  ? 'bg-[#ff003d]/10 text-[#ff003d]'
                  : 'bg-white text-neutral-500'
                  }`}
              >
                {counts[t.id]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Panel con grilla ─────────────────────────────────────────── */}
      <div className="bg-white border-2 border-[#E8E8E5] rounded-2xl p-6 relative">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-400 py-8 text-center">
            No hay imágenes en esta categoría.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((image) => {
              const isArchived = image.status === 'archived'
              const isBusy = busyId === image.id
              const linkedSet = new Set(image.linked_sku_ids)

              return (
                <div
                  key={image.id}
                  className={`group relative border rounded-xl overflow-hidden bg-white transition-all ${image.is_cover
                    ? 'border-black ring-2 ring-black/10'
                    : 'border-[#E8E8E5]'
                    } ${isArchived ? 'opacity-50 grayscale' : ''} ${isBusy ? 'opacity-70' : ''}`}
                >
                  {/* Foto */}
                  <div className="relative aspect-[4/3] bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.storage_url}
                      alt={image.storage_path}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {image.is_cover && (
                      <span
                        className="absolute top-2 left-2 bg-black text-white text-[10px] font-semibold uppercase tracking-widest px-[27px] py-[5px] rounded-full flex items-center gap-1"
                        title="Destacada de la tipología"
                      >
                        <span aria-hidden>★</span> Destacada
                      </span>
                    )}

                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums">
                      #{image.sort_order}
                    </span>

                    {image.view_label && (
                      <span className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm border border-[#E8E8E5] text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full text-neutral-700">
                        {image.view_label}
                      </span>
                    )}
                  </div>

                  {/* Controles */}
                  <div className="p-3 space-y-3">
                    {/* Variantes propias (style del modelo actual) */}
                    {ownVariants.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1.5">
                          Variantes de {currentStyleName}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ownVariants.map((sku) => {
                            const linked = linkedSet.has(sku.id)
                            return (
                              <button
                                key={sku.id}
                                type="button"
                                onClick={() => handleToggleSku(image, sku.id)}
                                disabled={isBusy || isArchived}
                                className={`text-[10px] uppercase tracking-widest px-[27px] py-[5px] rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${linked
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

                    {/* Casas hermanas (otros style_names de la tipología) */}
                    {otherHouses.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1.5">
                          Aplica también a
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {otherHouses.map((house) => {
                            const houseSkus = skusByStyle.get(house) ?? []
                            const linkedCount = houseSkus.filter((s) =>
                              linkedSet.has(s.id),
                            ).length
                            const isFullyLinked = linkedCount === houseSkus.length
                            const isPartiallyLinked = linkedCount > 0 && !isFullyLinked
                            return (
                              <button
                                key={house}
                                type="button"
                                onClick={() => handleToggleHouse(image, house)}
                                disabled={isBusy || isArchived}
                                className={`text-[10px] uppercase tracking-widest px-[27px] py-[5px] rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isFullyLinked
                                  ? 'bg-[#ff003d] text-white border-[#ff003d]'
                                  : isPartiallyLinked
                                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                                    : 'bg-white text-neutral-700 border-[#E8E8E5] hover:border-[#ff003d] hover:text-[#ff003d]'
                                  }`}
                                title={
                                  isPartiallyLinked
                                    ? `${linkedCount} de ${houseSkus.length} variantes linkeadas`
                                    : house
                                }
                              >
                                {isFullyLinked ? '✓ ' : ''}
                                {house}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetCover(image)}
                        disabled={isBusy || isArchived || image.is_cover}
                        className="flex-1 text-[10px] uppercase tracking-widest border border-[#E8E8E5] px-[27px] py-[5px] rounded-full hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {image.is_cover ? '★ Destacada' : '☆ Destacada'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(image)}
                        disabled={isBusy || isArchived}
                        className="text-[10px] uppercase tracking-widest text-red-600 border border-red-200 px-[27px] py-[5px] rounded-full hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Archivar
                      </button>
                    </div>

                    {errors[image.id] && (
                      <p className="text-[10px] text-red-600 leading-snug">
                        {errors[image.id]}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Upload form dentro del panel — la tab activa fija is_exterior +
          image_type, sin selector duplicado. */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <ImageUploadForm
            modelId={modelId}
            linea={linea}
            tipologiaCode={tipologiaCode}
            styleName={currentStyleName}
            variante={variante}
            sistemaConstructivo={sistemaConstructivo}
            typologySkus={typologySkus}
            typologyHouses={typologyHouses}
            isExterior={activeTabConfig.isExterior}
            imageType={activeTabConfig.imageType}
            categoryLabel={activeTabConfig.label}
          />
        </div>
      </div>
    </div>
  )
}
