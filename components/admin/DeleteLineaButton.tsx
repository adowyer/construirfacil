'use client'

/**
 * components/admin/DeleteLineaButton.tsx
 *
 * Botón cliente para eliminar una línea con confirm.
 * Los modelos asociados quedan con linea_id NULL (FK ON DELETE SET NULL),
 * NO se borran del catálogo.
 */

import { useState, useTransition } from 'react'
import { deleteLinea } from '@/app/admin/lineas/actions'

export function DeleteLineaButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la línea "${name}" permanentemente?\n\n` +
          'Los modelos asociados quedarán sin línea asignada (no se borran).\n' +
          'El contenido editorial (line_content) NO se elimina automáticamente.\n\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteLinea(id)
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
