// @ts-nocheck
/**
 * app/portal/models/page.tsx
 * List all models for the authenticated constructora owner.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'
import { getMyModels } from '@/lib/supabase/queries/models'
import type { HouseModelStatus } from '@/types/database'

const STATUS_LABELS: Record<HouseModelStatus, string> = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  published: 'Publicado',
  rejected: 'Rechazado',
}

const STATUS_CLASSES: Record<HouseModelStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-500',
  pending_review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function PortalModelsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const constructora = await getMyConstructora(supabase, user.id)
  if (!constructora) redirect('/portal/onboarding')

  const models = await getMyModels(supabase, constructora.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Mis modelos
        </h1>
        {constructora.status === 'approved' && (
          <Link
            href="/portal/models/new"
            className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
          >
            + Nuevo modelo
          </Link>
        )}
      </div>

      {models.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-16 text-center">
          <p className="text-neutral-400 mb-4">
            {constructora.status === 'approved'
              ? 'Todavía no creaste ningún modelo.'
              : 'Tu constructora está pendiente de aprobación.'}
          </p>
          {constructora.status === 'approved' && (
            <Link
              href="/portal/models/new"
              className="inline-block bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              Crear primer modelo
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-semibold">{model.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {model.bedrooms} dorm. · {model.total_area_m2} m²
                  {model.price_from_usd && ` · USD ${model.price_from_usd.toLocaleString('es-AR')}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[model.status]}`}
                >
                  {STATUS_LABELS[model.status]}
                </span>
                <div className="flex gap-3 text-xs">
                  <Link
                    href={`/portal/models/${model.id}`}
                    className="underline hover:no-underline"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/portal/models/${model.id}/images`}
                    className="underline hover:no-underline text-neutral-500"
                  >
                    Imágenes
                  </Link>
                  {model.status === 'published' && (
                    <Link
                      href={`/models/${model.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline text-neutral-500"
                    >
                      Ver
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
