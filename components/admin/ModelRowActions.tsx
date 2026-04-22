'use client'

/**
 * components/admin/ModelRowActions.tsx
 *
 * Client component: status toggle, archive, and delete confirmation buttons
 * for each row in the house_catalog admin list.
 */

import { useTransition } from 'react'
import Link from 'next/link'
import { setModelStatus, deleteModel } from '@/app/admin/models/actions'

interface ModelRowActionsProps {
  id: string
  currentStatus: string
}

export function ModelRowActions({ id, currentStatus }: ModelRowActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = currentStatus === 'active' ? 'inactive' : 'active'
    startTransition(() => {
      setModelStatus(id, next as 'active' | 'inactive' | 'archived')
    })
  }

  function handleArchive() {
    if (!confirm('¿Archivar este modelo? Quedará oculto del catálogo público.')) return
    startTransition(() => {
      setModelStatus(id, 'archived')
    })
  }

  const toggleLabel = currentStatus === 'active' ? 'Desactivar' : 'Activar'

  return (
    <div className={`flex items-center gap-3 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      <Link
        href={`/admin/models/${id}`}
        className="text-xs underline hover:no-underline text-neutral-700"
      >
        Editar
      </Link>

      {currentStatus !== 'archived' && (
        <button
          type="button"
          onClick={handleToggle}
          className="text-xs underline hover:no-underline text-neutral-500"
        >
          {toggleLabel}
        </button>
      )}

      {currentStatus !== 'archived' && (
        <button
          type="button"
          onClick={handleArchive}
          className="text-xs underline hover:no-underline text-neutral-400"
        >
          Archivar
        </button>
      )}
    </div>
  )
}
