'use client'

/**
 * components/admin/DeleteHomeSlideButton.tsx
 * Borra una fila de home_slide_content → ese slot vuelve al default.
 */

import { useState, useTransition } from 'react'
import { deleteHomeSlide } from '@/app/admin/home/actions'
import type { HomeVariant } from '@/lib/supabase/queries/home_content'

export function DeleteHomeSlideButton({
  id,
  name,
  scope,
}: {
  id: string
  name: string
  scope: HomeVariant
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar "${name}"?\n\nEse slot vuelve a su contenido por defecto.\nNo se puede deshacer.`,
      )
    )
      return
    setError(null)
    startTransition(async () => {
      const r = await deleteHomeSlide(id, scope)
      if (r?.error) setError(r.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-red-600 border border-red-200 px-[27px] py-[5px] rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Eliminando…' : 'Eliminar permanentemente'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
