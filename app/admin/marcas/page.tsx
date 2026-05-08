/**
 * app/admin/marcas/page.tsx
 * Admin list of all marcas, pending first.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import type { MarcaStatus } from '@/types/database'

const STATUS_LABELS: Record<MarcaStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_CLASSES: Record<MarcaStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function AdminMarcasPage() {
  const supabase = await createClient()
  const marcas = await getAllMarcas(supabase)

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Marcas ({marcas.length})
        </h1>
        <Link
          href="/admin/marcas/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva marca
        </Link>
      </div>

      {marcas.length === 0 ? (
        <p className="text-neutral-400">No hay marcas registradas.</p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {marcas.map((c) => (
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
                <Link
                  href={`/admin/marcas/${c.id}`}
                  className="text-xs underline hover:no-underline"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
