'use client'

/**
 * app/admin/models/[id]/_components/ImageGallery.tsx
 *
 * Client component that renders the existing model_images for a single
 * house_catalog row and exposes per-image controls:
 *   - Toggle cover (atomic via the server action)
 *   - Change image_type
 *   - Archive (with confirm dialog)
 *
 * The gallery itself is fed from the server component (page.tsx), which is
 * the source of truth — after each successful mutation we call router.refresh()
 * to pull a fresh snapshot. The server actions also revalidate the relevant
 * paths, but router.refresh() ensures the active client view updates without
 * waiting for navigation.
 */

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveImage,
  setCoverImage,
  setImageType,
  type ActionResult,
} from '@/app/admin/models/[id]/image-actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GalleryImage = {
  id: string
  storage_url: string
  storage_path: string
  is_cover: boolean
  is_exterior: boolean
  image_type: string | null
  sort_order: number
  status: string
  style_name: string | null
  variante: string | null
}

type ImageScope = 'variant' | 'model' | 'typology'

function computeScope(
  image: { style_name: string | null; variante: string | null },
  modelStyleName: string | null,
): ImageScope {
  // Compartida con la tipología (sin style ni variante)
  if (image.style_name === null && image.variante === null) return 'typology'
  // Compartida con todas las variantes del modelo (style sí, variante no)
  if (image.style_name === modelStyleName && image.variante === null) return 'model'
  // Específica de esta variante
  return 'variant'
}

interface ImageGalleryProps {
  modelId: string
  linea: string
  tipologiaCode: string
  styleName: string | null
  variante: string | null
  sistemaConstructivo: string | null
  images: GalleryImage[]
  /** Whether to show archived rows (muted). */
  showArchived?: boolean
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'render', label: 'Render' },
  { value: 'plano', label: 'Plano' },
  { value: 'axonometria', label: 'Axonometría' },
  { value: 'cover', label: 'Cover' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageGallery({
  modelId,
  linea,
  tipologiaCode,
  styleName,
  variante,
  sistemaConstructivo,
  images,
  showArchived = false,
}: ImageGalleryProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Per-image error so each card can surface its own failure independently.
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Track which row is currently mutating (for visual feedback).
  const [busyId, setBusyId] = useState<string | null>(null)

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

  function handleSetCover(image: GalleryImage) {
    setBusyId(image.id)
    startTransition(async () => {
      const result = await setCoverImage(
        image.id,
        { linea, tipologiaCode, styleName, variante },
        modelId,
      )
      handleResult(image.id, result)
    })
  }

  function handleChangeType(image: GalleryImage, nextType: string) {
    if (nextType === image.image_type) return
    setBusyId(image.id)
    startTransition(async () => {
      const result = await setImageType(image.id, nextType, modelId)
      handleResult(image.id, result)
    })
  }

  function handleArchive(image: GalleryImage) {
    if (
      !confirm(
        '¿Archivar esta imagen? Quedará oculta del catálogo público pero se puede restaurar luego.',
      )
    )
      return
    setBusyId(image.id)
    startTransition(async () => {
      const result = await archiveImage(image.id, modelId)
      handleResult(image.id, result)
    })
  }

  // Decision: by default archived rows are hidden. The toggle re-renders them
  // muted so admins can spot mistakes without leaving the page.
  const visible = images.filter((img) =>
    showArchived ? true : img.status !== 'archived',
  )

  if (visible.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        Todavía no hay imágenes para este modelo. Subí la primera abajo.
      </p>
    )
  }

  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${
        isPending ? 'opacity-90' : ''
      }`}
    >
      {visible.map((image) => {
        const isArchived = image.status === 'archived'
        const isBusy = busyId === image.id
        const scope = computeScope(image, styleName)
        const isShared = scope !== 'variant'
        return (
          <div
            key={image.id}
            className={`group relative border rounded-xl overflow-hidden bg-white transition-all ${
              image.is_cover
                ? 'border-black ring-2 ring-black/10'
                : 'border-[#E8E8E5]'
            } ${isArchived ? 'opacity-50 grayscale' : ''}`}
          >
            <div className="relative aspect-[4/3] bg-neutral-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.storage_url}
                alt={image.storage_path}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Cover star */}
              {image.is_cover && (
                <span
                  className="absolute top-2 left-2 bg-black text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1"
                  title="Imagen de portada"
                >
                  <span aria-hidden>★</span> Portada
                </span>
              )}

              {/* Type + exterior badges */}
              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                {image.image_type && (
                  <span className="bg-white/90 backdrop-blur-sm border border-[#E8E8E5] text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full text-neutral-700">
                    {image.image_type}
                  </span>
                )}
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                    image.is_exterior
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  {image.is_exterior ? 'Exterior' : 'Interior'}
                </span>
              </div>

              {/* Sort order */}
              <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums">
                #{image.sort_order}
              </span>

              {scope === 'model' && (
                <span
                  className="absolute bottom-2 right-2 bg-amber-500 text-white text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                  title={`Compartida con todas las variantes de ${styleName}`}
                >
                  Modelo
                </span>
              )}
              {scope === 'typology' && (
                <span
                  className="absolute bottom-2 right-2 bg-violet-500 text-white text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                  title="Compartida con todos los modelos de esta tipología"
                >
                  Tipología
                </span>
              )}

              {isArchived && (
                <span className="absolute bottom-2 right-2 bg-neutral-900 text-white text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full">
                  Archivada
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              {/* Type selector */}
              <div>
                <label
                  htmlFor={`type-${image.id}`}
                  className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-1"
                >
                  Tipo
                </label>
                <select
                  id={`type-${image.id}`}
                  value={image.image_type ?? 'render'}
                  onChange={(e) => handleChangeType(image, e.target.value)}
                  disabled={isBusy || isArchived || isShared}
                  className="w-full border border-[#E8E8E5] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-black transition-colors bg-white disabled:opacity-50"
                  title={
                    isShared
                      ? 'Esta imagen es compartida — editala desde otro modelo si querés cambiar su tipo (afecta a todos los que la heredan).'
                      : undefined
                  }
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSetCover(image)}
                  disabled={isBusy || isArchived || image.is_cover || isShared}
                  className="flex-1 text-[10px] uppercase tracking-widest border border-[#E8E8E5] px-2 py-1.5 rounded-full hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    isShared
                      ? 'Las imágenes compartidas no pueden ser portada — subí una específica del modelo.'
                      : image.is_cover
                        ? 'Ya es la portada'
                        : 'Marcar como portada del modelo'
                  }
                >
                  {image.is_cover ? '★ Portada' : '☆ Portada'}
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(image)}
                  disabled={isBusy || isArchived || isShared}
                  className="text-[10px] uppercase tracking-widest text-red-600 border border-red-200 px-2 py-1.5 rounded-full hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    isShared
                      ? 'Esta imagen es compartida — archivala desde otro modelo (afecta a todos los que la heredan).'
                      : 'Archivar imagen'
                  }
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
  )
}
