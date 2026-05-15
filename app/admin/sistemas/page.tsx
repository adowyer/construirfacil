/**
 * app/admin/sistemas/page.tsx
 * Listado admin de sistema_constructivo_content (copy editorial por sistema
 * constructivo, consumido por el panel SC del catálogo público).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllSistemaConstructivo } from '@/lib/supabase/queries/sistema-constructivo'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import type { SistemaConstructivoRow } from '@/lib/supabase/queries/sistema-constructivo'

const STATUS_LABELS: Record<SistemaConstructivoRow['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
}

const STATUS_CLASSES: Record<SistemaConstructivoRow['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminSistemasPage() {
  const supabase = await createClient()
  const [items, marcas] = await Promise.all([
    getAllSistemaConstructivo(supabase),
    getAllMarcas(supabase),
  ])
  const marcaName = new Map(marcas.map((m) => [m.id, m.name]))

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Sistemas constructivos ({items.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Copy editorial por sistema (Steel / Wood / Stone Plus). El catálogo
            prefiere la fila de la marca; si no hay, usa la global.
          </p>
        </div>
        <Link
          href="/admin/sistemas/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nuevo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-400">
          No hay contenido de sistemas cargado. El catálogo usa el texto legacy
          de <code>brand_content</code>.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {items.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {c.name}{' '}
                  <span className="text-xs text-neutral-400 font-normal">
                    ({c.slug})
                  </span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {c.marca_id ? (
                    <span className="text-neutral-500">
                      Propietario · {marcaName.get(c.marca_id) ?? 'marca desconocida'}
                    </span>
                  ) : (
                    <span className="text-neutral-500">Compartido</span>
                  )}
                  {' · '}
                  orden {c.sort_order}
                  {c.tagline && (
                    <>
                      {' · '}
                      <span className="italic">"{c.tagline}"</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[c.status]}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>
                <Link
                  href={`/admin/sistemas/${c.id}`}
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
