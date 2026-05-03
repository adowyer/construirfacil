'use client'

/**
 * components/admin/DeleteMarcaButton.tsx
 *
 * Client button para eliminar una marca con confirmación.
 * Si la marca tiene líneas asociadas, las elimina por CASCADE.
 * Los house_catalog asociados quedan con marca_id NULL (ON DELETE SET NULL).
 */

import { useState, useTransition } from 'react'
import { deleteMarca } from '@/app/admin/marcas/actions'

export function DeleteMarcaButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la marca "${name}" permanentemente?\n\n` +
          'Sus líneas serán eliminadas en cascada. Los modelos del catálogo ' +
          'quedarán sin marca asignada (no se borran).\n\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteMarca(id)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-red-600 border border-red-200 px-4 py-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Eliminando…' : 'Eliminar permanentemente'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
