/**
 * app/admin/tipologias/page.tsx
 * Listado admin de tipologia_catalog (librería de tipologías arquitectónicas
 * — EJE/NODO/ZETA/DECK + extensiones por marca).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllTipologias } from '@/lib/supabase/queries/tipologia'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import type { TipologiaRow } from '@/lib/supabase/queries/tipologia'

const STATUS_LABELS: Record<TipologiaRow['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
}

const STATUS_CLASSES: Record<TipologiaRow['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminTipologiasPage() {
  const supabase = await createClient()
  const [items, marcas] = await Promise.all([
    getAllTipologias(supabase),
    getAllMarcas(supabase),
  ])
  const marcaName = new Map(marcas.map((m) => [m.id, m.name]))

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Tipologías ({items.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Partido arquitectónico que entra al nombre comercial:{' '}
            <code>CASA &lt;CODE&gt; Estilo &lt;ESTILO&gt;</code>. El catálogo
            prefiere la fila de la marca; si no hay, usa la compartida.
          </p>
        </div>
        <Link
          href="/admin/tipologias/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-400">
          No hay tipologías cargadas. El catálogo muestra el raw code de cada SKU.
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
                  <span className="font-mono">{c.code}</span>
                  <span className="text-neutral-300 mx-2">·</span>
                  <span className="font-normal text-neutral-700">{c.nombre}</span>
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
                  {c.descripcion && (
                    <>
                      {' · '}
                      <span className="italic">"{c.descripcion.slice(0, 70)}{c.descripcion.length > 70 ? '…' : ''}"</span>
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
                  href={`/admin/tipologias/${c.id}`}
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
