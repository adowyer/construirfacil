'use client'

/**
 * components/admin/DeleteMarcaZonaButton.tsx
 *
 * Botón cliente para eliminar una regla de marca_zonas con confirmación.
 */

import { useState, useTransition } from 'react'
import { deleteMarcaZona } from '@/app/admin/marcas/[id]/zonas/actions'

export function DeleteMarcaZonaButton({
  marcaId,
  id,
  description,
}: {
  marcaId: string
  id: string
  description: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar esta regla zonal?\n\n${description}\n\nNo se puede deshacer.`,
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteMarcaZona(marcaId, id)
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
        {isPending ? 'Eliminando…' : 'Eliminar regla'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
