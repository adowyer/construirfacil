/**
 * app/admin/marcas/[id]/zonas/page.tsx
 * Listado de reglas zonales (marca_zonas) de una marca.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMarcaById } from '@/lib/supabase/queries/marcas'
import {
  getAllProvincias,
  getMarcaZonasByMarca,
} from '@/lib/supabase/queries/zones'
import { getLineasByMarca } from '@/lib/supabase/queries/lineas'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABELS = {
  active: 'Activa',
  inactive: 'Inactiva',
  archived: 'Archivada',
} as const

const STATUS_CLASSES = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
} as const

export default async function MarcaZonasPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [marca, rules, provincias, lineas] = await Promise.all([
    getMarcaById(supabase, id),
    getMarcaZonasByMarca(supabase, id),
    getAllProvincias(supabase),
    getLineasByMarca(supabase, id),
  ])

  if (!marca) notFound()

  const provById = new Map(provincias.map((p) => [p.id, p.name]))
  const lineaById = new Map(lineas.map((l) => [l.id, l.name]))

  // Ordenamos por provincia, luego por especificidad (general primero).
  const sorted = [...rules].sort((a, b) => {
    const provA = provById.get(a.provincia_id) ?? ''
    const provB = provById.get(b.provincia_id) ?? ''
    if (provA !== provB) return provA.localeCompare(provB)
    const scoreA = (a.linea_id ? 2 : 0) + (a.sistema_constructivo ? 1 : 0)
    const scoreB = (b.linea_id ? 2 : 0) + (b.sistema_constructivo ? 1 : 0)
    return scoreA - scoreB
  })

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/marcas" className="hover:text-black transition-colors">
          Marcas
        </Link>
        <span>/</span>
        <Link
          href={`/admin/marcas/${id}`}
          className="hover:text-black transition-colors"
        >
          {marca.name}
        </Link>
        <span>/</span>
        <span className="text-black">Zonas</span>
      </div>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Zonas de {marca.name} ({rules.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Reglas por provincia: excluir, ajustar precio, cobrar transporte,
            ofrecer promoción o derivar a cotización personal. La regla
            "general" (sin línea y sin SC) aplica a todas; reglas más finas
            (con línea y/o SC) la pisan.
          </p>
        </div>
        <Link
          href={`/admin/marcas/${id}/zonas/new`}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva regla
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="text-neutral-400">
          No hay reglas zonales. El catálogo muestra todos los modelos de la
          marca sin restricciones ni ajustes de precio.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {sorted.map((r) => {
            const provName = provById.get(r.provincia_id) ?? '—'
            const lineaName = r.linea_id ? (lineaById.get(r.linea_id) ?? '—') : 'Todas'
            const scName = r.sistema_constructivo ?? 'Todos'
            const tags: string[] = []
            if (r.excluded) tags.push('Excluida')
            if (r.contact_only) tags.push('Cotización personal')
            if (r.price_modifier_pct != null && r.price_modifier_pct !== 0) {
              const sign = r.price_modifier_pct > 0 ? '+' : ''
              tags.push(`${sign}${r.price_modifier_pct}%`)
            }
            if (r.extra_charge_amount != null && r.extra_charge_amount !== 0) {
              tags.push(`+ USD ${r.extra_charge_amount.toLocaleString('es-AR')}`)
            }
            if (r.promo_label) tags.push(`🏷️ ${r.promo_label}`)

            return (
              <div
                key={r.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {provName}
                    <span className="text-neutral-300 mx-2">·</span>
                    <span className="font-normal text-neutral-600">
                      {lineaName}
                    </span>
                    <span className="text-neutral-300 mx-2">·</span>
                    <span className="font-normal text-neutral-600">
                      {scName}
                    </span>
                  </p>
                  {tags.length > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {tags.join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[r.status]}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                  <Link
                    href={`/admin/marcas/${id}/zonas/${r.id}`}
                    className="text-xs underline hover:no-underline"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
