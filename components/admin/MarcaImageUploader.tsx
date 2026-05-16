'use client'

/**
 * components/admin/MarcaImageUploader.tsx
 *
 * Uploader genérico de un activo visual de marca (isologo o isotipo).
 * Sube al bucket `marca-logos` vía la server action recibida y actualiza la
 * columna correspondiente de `marcas`. Funciona tanto en /admin/marcas/[id]
 * (admin) como en /portal/settings (dueño de la marca) — la autorización la
 * resuelve la action.
 *
 * Sólo se muestra en páginas con un marcaId real (el upload lo necesita).
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MarcaImageActionResult } from '@/app/admin/marcas/actions'

const ACCEPTED_MIME = 'image/png, image/jpeg, image/webp, image/svg+xml'

interface Props {
  marcaId: string
  marcaName: string
  initialUrl: string | null
  /** Título visible, ej. "Isologo" / "Isotipo". */
  title: string
  /** Línea de ayuda bajo el título. */
  hint: string
  /** Palabra para botones / confirmaciones, ej. "isologo" / "isotipo". */
  assetWord: string
  uploadAction: (
    marcaId: string,
    formData: FormData,
  ) => Promise<MarcaImageActionResult>
  removeAction: (marcaId: string) => Promise<MarcaImageActionResult>
}

export function MarcaImageUploader({
  marcaId,
  marcaName,
  initialUrl,
  title,
  hint,
  assetWord,
  uploadAction,
  removeAction,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(initialUrl)
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
      const result = await uploadAction(marcaId, formData)
      if (result.ok) {
        setUrl(result.url)
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
    if (!confirm(`¿Eliminar el ${assetWord} de "${marcaName}"?`)) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await removeAction(marcaId)
      if (result.ok) {
        setUrl(null)
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
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${title} de ${marcaName}`}
              className="w-32 h-32 object-contain border border-[#E8E8E5] rounded-lg bg-[#FAFAF8] p-2"
            />
          ) : (
            <div className="w-32 h-32 flex items-center justify-center border border-dashed border-[#D8D8D5] rounded-lg bg-[#FAFAF8] text-[10px] uppercase tracking-widest text-neutral-400 text-center px-3">
              Sin {assetWord}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 mb-1">
            {title}
          </p>
          <p className="text-xs text-neutral-500 mb-4">{hint}</p>

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
              {isPending
                ? 'Subiendo…'
                : url
                ? `Cambiar ${assetWord}`
                : `Subir ${assetWord}`}
            </button>

            {url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="text-red-600 border border-red-200 px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar {assetWord}
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {error}
            </p>
          )}
          {success && !error && (
            <p className="text-sm text-green-600 mt-3">{title} actualizado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
