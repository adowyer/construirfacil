'use client'

/**
 * components/admin/DeleteTipologiaButton.tsx
 *
 * Botón cliente para eliminar una fila de tipologia_catalog con confirmación.
 * Al borrarla el catálogo cae al fallback (fila compartida del mismo code o,
 * si no hay, al texto raw de house_catalog.tipologia_code_new).
 */

import { useState, useTransition } from 'react'
import { deleteTipologia } from '@/app/admin/tipologias/actions'

export function DeleteTipologiaButton({
  id,
  code,
}: {
  id: string
  code: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la tipología "${code}" permanentemente?\n\n` +
          'El catálogo volverá a usar la tipología global del mismo code o el texto raw.\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteTipologia(id)
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
