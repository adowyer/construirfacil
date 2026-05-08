/**
 * app/admin/lineas/page.tsx
 * Listado admin de líneas, agrupado por marca.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllLineasWithMarca } from '@/lib/supabase/queries/lineas'
import type { LineaWithMarca } from '@/lib/supabase/queries/lineas'

const STATUS_LABELS: Record<LineaWithMarca['status'], string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  archived: 'Archivada',
}

const STATUS_CLASSES: Record<LineaWithMarca['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminLineasPage() {
  const supabase = await createClient()
  const lineas = await getAllLineasWithMarca(supabase)

  // Agrupar por marca preservando orden devuelto por la query.
  const grouped = new Map<
    string,
    { marca: LineaWithMarca['marca']; lineas: LineaWithMarca[] }
  >()
  for (const l of lineas) {
    const key = l.marca?.id ?? l.marca_id ?? '__sin_marca__'
    if (!grouped.has(key)) {
      grouped.set(key, { marca: l.marca, lineas: [] })
    }
    grouped.get(key)!.lineas.push(l)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Líneas ({lineas.length})
        </h1>
        <Link
          href="/admin/lineas/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva línea
        </Link>
      </div>

      {lineas.length === 0 ? (
        <p className="text-neutral-400">No hay líneas registradas.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.values()).map(({ marca, lineas: lineasOfMarca }) => (
            <section key={marca?.id ?? '__sin_marca__'}>
              <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-3">
                {marca?.name ?? 'Sin marca'}
              </h2>
              <div className="border border-neutral-200 divide-y divide-neutral-200">
                {lineasOfMarca.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {l.tagline ?? <span className="italic">sin tagline</span>}
                        {' · '}
                        slug <code className="text-neutral-500">{l.slug}</code>
                        {' · '}
                        orden {l.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[l.status]}`}
                      >
                        {STATUS_LABELS[l.status]}
                      </span>
                      <Link
                        href={`/admin/lineas/${l.id}`}
                        className="text-xs underline hover:no-underline"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
