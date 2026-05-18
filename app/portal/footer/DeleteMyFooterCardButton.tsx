'use client'

/**
 * app/portal/footer/DeleteMyFooterCardButton.tsx
 * Borra una card del footer propia de la marca (con confirmación).
 */

import { useState, useTransition } from 'react'
import { deleteMyFooterCard } from './actions'

export function DeleteMyFooterCardButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`¿Eliminar la card "${name}"? Esta acción no se puede deshacer.`))
      return
    setError(null)
    startTransition(async () => {
      const r = await deleteMyFooterCard(id)
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
