'use client'

/**
 * components/admin/DeleteSistemaConstructivoButton.tsx
 *
 * Botón cliente para eliminar una fila de sistema_constructivo_content con
 * confirmación. Al borrarla el catálogo cae al fallback (fila global o, si
 * no hay, al texto legacy de brand_content).
 */

import { useState, useTransition } from 'react'
import { deleteSistemaConstructivo } from '@/app/admin/sistemas/actions'

export function DeleteSistemaConstructivoButton({
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
          'El catálogo volverá a usar el contenido global o el texto legacy.\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteSistemaConstructivo(id)
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
