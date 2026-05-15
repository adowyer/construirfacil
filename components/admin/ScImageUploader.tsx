'use client'

/**
 * components/admin/ScImageUploader.tsx
 *
 * Sección admin para subir / cambiar / eliminar la foto de fondo de la
 * columna de un sistema constructivo (panel SC del catálogo). Si no hay
 * foto, el catálogo usa la foto de la línea preferida (Steel→Bosque,
 * Wood→Atlas, Stone→Terra) como hasta ahora.
 *
 * Solo se renderea en la página de edit (necesita un id existente).
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeScImage, uploadScImage } from '@/app/admin/sistemas/actions'

interface Props {
  scId: string
  scName: string
  initialImageUrl: string | null
}

const ACCEPTED_MIME = 'image/png, image/jpeg, image/webp'

export function ScImageUploader({ scId, scName, initialImageUrl }: Props) {
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
      const result = await uploadScImage(scId, formData)
      if (result.ok) {
        setImageUrl(result.heroImageUrl)
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
    if (!confirm(`¿Eliminar la foto de "${scName}"?`)) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await removeScImage(scId)
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
        {/* Preview en proporción de la columna del catálogo */}
        <div className="flex-shrink-0">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`Foto de ${scName}`}
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
            Foto de fondo
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            PNG, JPG o WebP. Máx 5 MB. Idealmente horizontal y de buena
            resolución — se usa como fondo a pantalla completa de la columna,
            con un overlay encima. Si la dejás vacía, el catálogo usa una foto
            de la línea preferida del sistema.
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
