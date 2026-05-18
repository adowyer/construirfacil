/**
 * app/admin/campanas/dashboard/page.tsx
 * Dashboard por banner: embudo visitas → ficha → cotizar → leads, por
 * localidad y por medio. Lee tablas internas con service-role.
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCampaignMetrics,
  type FunnelRow,
} from '@/lib/supabase/queries/campaign_metrics'

const RANGES = [30, 90, 365]

function pct(n: number, d: number): string {
  if (!d) return '—'
  return `${((n / d) * 100).toFixed(1)}%`
}

function FunnelTable({
  title,
  rows,
}: {
  title: string
  rows: FunnelRow[]
}) {
  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-neutral-400 text-sm">Sin datos en el rango.</p>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-[11px] uppercase tracking-widest text-neutral-400">
                <th className="px-4 py-3 font-semibold">Clave</th>
                <th className="px-4 py-3 font-semibold text-right">Visitas</th>
                <th className="px-4 py-3 font-semibold text-right">Ficha</th>
                <th className="px-4 py-3 font-semibold text-right">Cotizar</th>
                <th className="px-4 py-3 font-semibold text-right">Leads</th>
                <th className="px-4 py-3 font-semibold text-right">
                  Conv. (lead/visita)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.visits}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.modelOpens}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.cotizar}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {r.leads}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {pct(r.leads, r.visits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default async function CampaignDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const sp = await searchParams
  const sinceDays = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 90

  const admin = createAdminClient()
  const m = await getCampaignMetrics(admin, { sinceDays })
  const t = m.totals

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href="/admin/campanas"
          className="hover:text-black transition-colors"
        >
          Campañas
        </Link>
        <span>/</span>
        <span className="text-black">Dashboard</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Dashboard por banner
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Últimos {sinceDays} días. Visita = sesión distinta que aterrizó.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/campanas/dashboard?days=${d}`}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-full transition-colors ${
                d === sinceDays
                  ? 'bg-[#ff003d] text-white'
                  : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        {[
          { k: 'Visitas', v: t.visits },
          { k: 'Fichas abiertas', v: t.modelOpens },
          { k: 'Cotizar', v: t.cotizar },
          { k: 'Leads', v: t.leads },
        ].map((c) => (
          <div
            key={c.k}
            className="border border-neutral-200 rounded-lg px-5 py-4"
          >
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
              {c.k}
            </p>
            <p className="text-3xl font-black tabular-nums mt-1">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-12">
        <FunnelTable
          title="Por localidad (banner / campaña)"
          rows={m.byLocalidad}
        />
        <FunnelTable title="Por medio (utm_source)" rows={m.byMedio} />
      </div>

      <p className="text-xs text-neutral-400 mt-12 max-w-2xl">
        El costo-por-lead se calcula con el costo de pauta de cada medio (dato
        externo de las plataformas). Cruzá la columna Leads por medio con lo
        que pagás a cada uno. La inversión por medio se puede sumar como campo
        en una iteración futura.
      </p>
    </div>
  )
}
