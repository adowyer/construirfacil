'use client'

/**
 * components/admin/DeleteHeaderSlideButton.tsx
 *
 * Borra una fila de header_slide_content con confirmación. Al borrarla, ese
 * slide del header vuelve a usar su texto/foto hardcoded por defecto.
 */

import { useState, useTransition } from 'react'
import { deleteHeaderSlide } from '@/app/admin/header/actions'
import type { HeaderVariant } from '@/lib/supabase/queries/header_content'

export function DeleteHeaderSlideButton({
  id,
  name,
  scope,
}: {
  id: string
  name: string
  scope: HeaderVariant
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar "${name}" permanentemente?\n\n` +
          'Ese slide volverá a usar su contenido por defecto.\n' +
          'Esta acción no se puede deshacer.',
      )
    )
      return

    setError(null)
    startTransition(async () => {
      const result = await deleteHeaderSlide(id, scope)
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
