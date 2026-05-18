'use client'

/**
 * components/admin/DeleteCampaignButton.tsx
 * Borra una campaña → su /casa-financiada/<slug> vuelve al home normal.
 */

import { useState, useTransition } from 'react'
import { deleteCampaign } from '@/app/admin/campanas/actions'

export function DeleteCampaignButton({
  id,
  slug,
  name,
}: {
  id: string
  slug: string
  name: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la campaña "${name}"?\n\n/casa-financiada/${slug} vuelve al home normal.\nLos links ya repartidos dejan de matchear contenido (siguen midiendo).\nNo se puede deshacer.`,
      )
    )
      return
    setError(null)
    startTransition(async () => {
      const r = await deleteCampaign(id, slug)
      if (r?.error) setError(r.error)
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
