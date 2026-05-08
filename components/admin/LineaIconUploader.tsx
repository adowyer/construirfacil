'use client'

/**
 * components/admin/LineaIconUploader.tsx
 *
 * Sección admin para subir / cambiar / eliminar el ícono representativo de
 * una línea. El ícono se muestra en la ficha colapsada del catálogo público
 * (estilo BIG.dk) para identificar visualmente a qué línea pertenece cada
 * modelo cuando hay mezcla en los resultados de filtros.
 *
 * Solo se renderea en la página de edit (no en /admin/lineas/new) porque
 * el upload necesita un linea_id existente.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeLineaIcon,
  uploadLineaIcon,
} from '@/app/admin/lineas/actions'

interface Props {
  lineaId: string
  lineaName: string
  initialIconUrl: string | null
}

const ACCEPTED_MIME = 'image/png, image/jpeg, image/webp, image/svg+xml'

export function LineaIconUploader({ lineaId, lineaName, initialIconUrl }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [iconUrl, setIconUrl] = useState<string | null>(initialIconUrl)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
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
      const result = await uploadLineaIcon(lineaId, formData)
      if (result.ok) {
        setIconUrl(result.iconUrl)
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
    if (!confirm(`¿Eliminar el ícono de "${lineaName}"?`)) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await removeLineaIcon(lineaId)
      if (result.ok) {
        setIconUrl(null)
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
        {/* Preview en fondo oscuro para que se vea como en el catálogo */}
        <div className="flex-shrink-0">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconUrl}
              alt={`Ícono de ${lineaName}`}
              className="w-20 h-20 object-contain border border-[#E8E8E5] rounded-lg bg-black p-3"
            />
          ) : (
            <div className="w-20 h-20 flex items-center justify-center border border-dashed border-[#D8D8D5] rounded-lg bg-[#FAFAF8] text-[10px] uppercase tracking-widest text-neutral-400 text-center px-2">
              Sin ícono
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-1">
            Ícono de la línea
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            PNG, WebP o SVG. Máx 200 KB. Idealmente cuadrado (~64×64), monocromo,
            con fondo transparente. Se muestra en la ficha del catálogo y ayuda
            a identificar la línea cuando los filtros mezclan modelos.
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
              {isPending ? 'Subiendo…' : iconUrl ? 'Cambiar ícono' : 'Subir ícono'}
            </button>

            {iconUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="text-red-600 border border-red-200 px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar ícono
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {error}
            </p>
          )}
          {success && !error && (
            <p className="text-sm text-green-600 mt-3">Ícono actualizado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
