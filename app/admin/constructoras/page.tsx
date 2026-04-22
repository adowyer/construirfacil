/**
 * app/admin/constructoras/page.tsx
 * Admin list of all constructoras, pending first.
 */

import { createClient } from '@/lib/supabase/server'
import { getAllConstructoras } from '@/lib/supabase/queries/constructoras'
import type { ConstructoraStatus } from '@/types/database'

const STATUS_LABELS: Record<ConstructoraStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_CLASSES: Record<ConstructoraStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function AdminConstructorasPage() {
  const supabase = await createClient()
  const constructoras = await getAllConstructoras(supabase)

  return (
    <div>
      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Constructoras ({constructoras.length})
      </h1>

      {constructoras.length === 0 ? (
        <p className="text-neutral-400">No hay constructoras registradas.</p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {constructoras.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {[c.city, c.province].filter(Boolean).join(', ')}
                  {' · '}
                  Registrada{' '}
                  {new Date(c.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[c.status]}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>
                <a
                  href={`/admin/constructoras/${c.id}`}
                  className="text-xs underline hover:no-underline"
                >
                  Revisar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
