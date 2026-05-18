/**
 * app/admin/campanas/page.tsx
 * Admin de campañas de medios. Lista + alta. Cada fila = una localidad con
 * copy local que se inyecta como banner al tope del HomeRow.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllCampaigns } from '@/lib/supabase/queries/campaigns'

export default async function AdminCampaignsPage() {
  const supabase = await createClient()
  const campaigns = await getAllCampaigns(supabase)

  return (
    <div>
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Campañas de medios
          </h1>
          <p className="text-xs text-neutral-400 mt-2 max-w-xl">
            Una fila por localidad. El banner local aparece al tope del HomeRow
            en <code>/casa-financiada/&lt;slug&gt;</code>. Cada campaña tiene su
            generador de links UTM por medio.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/campanas/dashboard"
            className="border border-neutral-300 text-neutral-700 px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-neutral-100 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/campanas/new"
            className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
          >
            Nueva campaña
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Sin campañas. Creá una para empezar a repartir links a los medios.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {c.localidad}
                  {c.provincia && (
                    <span className="text-neutral-400 font-normal">
                      {' '}
                      · {c.provincia}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono truncate">
                  /casa-financiada/{c.slug}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`text-[11px] uppercase tracking-widest ${
                    c.active ? 'text-emerald-600' : 'text-neutral-400'
                  }`}
                >
                  {c.active ? 'Activa' : 'Inactiva'}
                </span>
                <Link
                  href={`/admin/campanas/${c.id}`}
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
