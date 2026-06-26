'use client'

/**
 * components/admin/DeleteTipologiaAttrButton.tsx
 *
 * Botón cliente para eliminar una fila de tipologia_attrs con confirmación.
 * Al borrarla el catálogo se queda sin descripción para ese (eje, valor) hasta
 * que se vuelva a cargar.
 */

import { useState, useTransition } from 'react'
import { deleteTipologiaAttr } from '@/app/admin/tipologias/attrs/actions'

export function DeleteTipologiaAttrButton({
  id,
  label,
}: {
  id: string
  label: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar "${label}" permanentemente?\n\n` +
          'El catálogo deja de mostrar la descripción para ese valor.\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteTipologiaAttr(id)
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
