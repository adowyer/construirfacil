'use client'

/**
 * components/admin/HeaderImageUploader.tsx
 *
 * Sube / cambia / elimina la foto principal de un slide del header
 * (bucket `header-images`). Mismo patrón que ScImageUploader. Solo se
 * renderea en la página de edit (necesita un id existente).
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeHeaderImage,
  uploadHeaderImage,
} from '@/app/admin/header/actions'

type ImgResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

interface Props {
  slideId: string
  slideName: string
  initialImageUrl: string | null
  /** Título del bloque. Default "Foto principal". */
  label?: string
  /** Texto de ayuda bajo el título. Default = el de la foto principal. */
  helpText?: React.ReactNode
  /** Override para el portal (acciones guardadas por marca). Default = admin. */
  uploadAction?: (slideId: string, formData: FormData) => Promise<ImgResult>
  removeAction?: (slideId: string) => Promise<ImgResult>
}

const ACCEPTED_MIME =
  'image/png, image/jpeg, image/webp, image/svg+xml, image/gif'

export function HeaderImageUploader({
  slideId,
  slideName,
  initialImageUrl,
  label = 'Foto principal',
  helpText,
  uploadAction = uploadHeaderImage,
  removeAction = removeHeaderImage,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      const result = await uploadAction(slideId, formData)
      if (result.ok) {
        setImageUrl(result.imageUrl)
        setSuccess(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      } else {
        setError(result.error)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  function handleRemove() {
    if (!confirm(`¿Eliminar la foto de "${slideName}"?`)) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await removeAction(slideId)
      if (result.ok) {
        setImageUrl(null)
        setSuccess(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="bg-white border border-[#E8E8E5] rounded-xl p-6">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`Foto de ${slideName}`}
              className="w-40 h-28 object-cover border border-[#E8E8E5] rounded-lg bg-black"
            />
          ) : (
            <div className="w-40 h-28 flex items-center justify-center border border-dashed border-[#D8D8D5] rounded-lg bg-[#FAFAF8] text-[10px] uppercase tracking-widest text-neutral-400 text-center px-2">
              Sin foto
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-1">
            {label}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            {helpText ?? (
              <>
                PNG, JPG, WebP, SVG o GIF. Máx 5 MB. En “Casa que crece” esta
                foto es el fondo (podés usar un GIF). Si la dejás vacía, el
                slide usa su imagen/animación por defecto.
              </>
            )}
          </p>

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME}
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handlePickFile}
              disabled={isPending}
              className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
            >
              {isPending ? 'Subiendo…' : imageUrl ? 'Cambiar foto' : 'Subir foto'}
            </button>

            {imageUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="text-red-600 border border-red-200 px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar foto
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {error}
            </p>
          )}
          {success && !error && (
            <p className="text-sm text-green-600 mt-3">Foto actualizada.</p>
          )}
        </div>
      </div>
    </div>
  )
}
