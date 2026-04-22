'use client'

/**
 * components/admin/DeleteModelButton.tsx
 *
 * Client component: "Delete permanently" button with window.confirm guard.
 */

import { useTransition } from 'react'
import { deleteModel } from '@/app/admin/models/actions'

export function DeleteModelButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (
      !confirm(
        '¿Eliminar este modelo permanentemente? Esta acción no se puede deshacer.',
      )
    )
      return

    startTransition(() => {
      deleteModel(id)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-red-600 border border-red-200 px-4 py-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Eliminando…' : 'Eliminar permanentemente'}
    </button>
  )
}
