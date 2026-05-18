'use client'

/**
 * app/portal/home/DeleteMyHomeSlideButton.tsx
 * Borra un slot propio del HomeRow de la marca → vuelve al default.
 */

import { useState, useTransition } from 'react'
import { deleteMyHomeSlide } from './actions'

export function DeleteMyHomeSlideButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar "${name}"? Ese slot vuelve al contenido por defecto. No se puede deshacer.`,
      )
    )
      return
    setError(null)
    startTransition(async () => {
      const r = await deleteMyHomeSlide(id)
      if (r?.error) setError(r.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-red-600 border border-red-200 px-5 py-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Eliminando…' : 'Eliminar'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
