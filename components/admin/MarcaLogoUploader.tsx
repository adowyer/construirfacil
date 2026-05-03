'use client'

/**
 * components/admin/MarcaLogoUploader.tsx
 *
 * Sección admin para subir / cambiar / eliminar el logo de una marca.
 * El upload llama a `uploadMarcaLogo` que sube al bucket `marca-logos` y
 * actualiza marcas.logo_url. La sección se muestra solo en la página de
 * edit (no en /admin/marcas/new), porque el upload necesita un marca_id.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeMarcaLogo,
  uploadMarcaLogo,
} from '@/app/admin/marcas/actions'

interface Props {
  marcaId: string
  marcaName: string
  initialLogoUrl: string | null
}

const ACCEPTED_MIME = 'image/png, image/jpeg, image/webp, image/svg+xml'

export function MarcaLogoUploader({ marcaId, marcaName, initialLogoUrl }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
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
      const result = await uploadMarcaLogo(marcaId, formData)
      if (result.ok) {
        setLogoUrl(result.logoUrl)
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
    if (!confirm(`¿Eliminar el logo de "${marcaName}"?`)) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await removeMarcaLogo(marcaId)
      if (result.ok) {
        setLogoUrl(null)
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
        {/* Preview */}
        <div className="flex-shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`Logo de ${marcaName}`}
              className="w-32 h-32 object-contain border border-[#E8E8E5] rounded-lg bg-[#FAFAF8] p-2"
            />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center border border-dashed border-[#D8D8D5] rounded-lg bg-[#FAFAF8] text-[10px] uppercase tracking-widest text-neutral-400 text-center px-3">
              Sin logo
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-1">
            Logo de la marca
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            PNG, JPG, WebP o SVG. Máx 2 MB. Idealmente cuadrado, fondo
            transparente, ~512×512.
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
              className="bg-black text-white px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>

            {logoUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="text-red-600 border border-red-200 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar logo
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {error}
            </p>
          )}
          {success && !error && (
            <p className="text-sm text-green-600 mt-3">Logo actualizado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
