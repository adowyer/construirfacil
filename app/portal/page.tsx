// @ts-nocheck
/**
 * app/portal/page.tsx
 * Constructora portal dashboard.
 */

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'
import { getMyModels } from '@/lib/supabase/queries/models'
import { redirect } from 'next/navigation'

export default async function PortalDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const constructora = await getMyConstructora(supabase, user.id)

  if (!constructora) redirect('/portal/onboarding')

  const models = await getMyModels(supabase, constructora.id)

  const counts = {
    draft: models.filter((m) => m.status === 'draft').length,
    pending: models.filter((m) => m.status === 'pending_review').length,
    published: models.filter((m) => m.status === 'published').length,
    rejected: models.filter((m) => m.status === 'rejected').length,
  }

  return (
    <div>
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        {constructora.name}
      </h1>
      <p className="text-neutral-500 text-sm mb-10 capitalize">
        Estado:{' '}
        <span
          className={
            constructora.status === 'approved'
              ? 'text-green-600 font-semibold'
              : constructora.status === 'pending'
              ? 'text-yellow-600 font-semibold'
              : 'text-red-600 font-semibold'
          }
        >
          {constructora.status === 'approved'
            ? 'Aprobada'
            : constructora.status === 'pending'
            ? 'Pendiente'
            : 'Rechazada'}
        </span>
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: 'Borradores', value: counts.draft },
          { label: 'En revisión', value: counts.pending },
          { label: 'Publicados', value: counts.published },
          { label: 'Rechazados', value: counts.rejected },
        ].map((stat) => (
          <div key={stat.label} className="border border-neutral-200 p-6">
            <p className="text-3xl font-black">{stat.value}</p>
            <p className="text-xs text-neutral-400 uppercase tracking-widest mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Recent models */}
      {models.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4">
            Modelos recientes
          </h2>
          <div className="border border-neutral-200 divide-y divide-neutral-200">
            {models.slice(0, 5).map((model) => (
              <div key={model.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-sm">{model.name}</p>
                  <p className="text-xs text-neutral-400">
                    {model.bedrooms} dorm. · {model.total_area_m2} m²
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs uppercase tracking-widest px-2 py-1 ${
                      model.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : model.status === 'pending_review'
                        ? 'bg-yellow-100 text-yellow-700'
                        : model.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {model.status === 'draft'
                      ? 'Borrador'
                      : model.status === 'pending_review'
                      ? 'En revisión'
                      : model.status === 'published'
                      ? 'Publicado'
                      : 'Rechazado'}
                  </span>
                  <Link
                    href={`/portal/models/${model.id}`}
                    className="text-xs underline hover:no-underline"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {models.length > 5 && (
            <Link
              href="/portal/models"
              className="block text-center text-sm underline hover:no-underline mt-4 text-neutral-500"
            >
              Ver todos ({models.length})
            </Link>
          )}
        </div>
      )}

      {constructora.status === 'approved' && models.length === 0 && (
        <div className="border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-neutral-400 mb-4">
            Todavía no publicaste ningún modelo.
          </p>
          <Link
            href="/portal/models/new"
            className="inline-block bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
          >
            Crear primer modelo
          </Link>
        </div>
      )}
    </div>
  )
}
