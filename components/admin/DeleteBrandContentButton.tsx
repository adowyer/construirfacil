'use client'

/**
 * components/admin/DeleteBrandContentButton.tsx
 *
 * Botón cliente para eliminar un brand_content con confirmación.
 * Borrarlo desactiva la sección correspondiente en el catálogo público.
 */

import { useState, useTransition } from 'react'
import { deleteBrandContent } from '@/app/admin/brand/actions'

export function DeleteBrandContentButton({
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
        `¿Eliminar "${name}" permanentemente?\n\n` +
          'La sección dejará de aparecer en el catálogo público.\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteBrandContent(id)
      if (result?.error) setError(result.error)
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
