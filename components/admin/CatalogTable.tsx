'use client'

/**
 * components/admin/CatalogTable.tsx
 *
 * Tabla del listado de modelos del admin, agrupada por línea.
 * Mantiene los filtros de status (tabs) + búsqueda en el cliente.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { HouseCatalogRow } from '@/lib/supabase/queries/models'
import { ModelRowActions } from './ModelRowActions'
import { InlinePriceCell } from './InlinePriceCell'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LineaInfo = {
  name: string
  sort_order: number
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-neutral-100 text-neutral-500',
  }
  const labels: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    archived: 'Archivado',
  }
  return (
    <span
      className={`inline-block text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${
        map[status] ?? 'bg-neutral-100 text-neutral-500'
      }`}
    >
      {labels[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'all' | 'active' | 'inactive' | 'archived'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'archived', label: 'Archivados' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABLE_HEADERS = [
  'Código',
  'Nombre',
  'Sistema',
  'Lista',
  'Contado',
  'Pozo',
  'Estado',
  '',
] as const

function ModelRow({ row }: { row: HouseCatalogRow }) {
  return (
    <tr className="hover:bg-[#F7F7F5] transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
        {row.variant_code}
      </td>
      <td className="px-4 py-3 font-semibold text-neutral-900 whitespace-nowrap">
        <Link href={`/admin/models/${row.id}`} className="hover:underline">
          {row.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">
        {row.construction_system ?? '—'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <InlinePriceCell
          modelId={row.id}
          field="precio_lista_usd"
          initial={row.precio_lista_usd}
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <InlinePriceCell
          modelId={row.id}
          field="precio_contado_usd"
          initial={row.precio_contado_usd}
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <InlinePriceCell
          modelId={row.id}
          field="precio_pozo_usd"
          initial={row.precio_pozo_usd}
        />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <ModelRowActions id={row.id} currentStatus={row.status} />
      </td>
    </tr>
  )
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-[#E8E8E5] bg-[#F7F7F5]">
        {TABLE_HEADERS.map((h, i) => (
          <th
            key={i}
            className="px-4 py-3 text-left text-[11px] uppercase tracking-widest text-neutral-400 font-semibold whitespace-nowrap"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CatalogTable({
  rows,
  lineas,
}: {
  rows: HouseCatalogRow[]
  lineas: LineaInfo[]
}) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false
      if (q) {
        return (
          r.name.toLowerCase().includes(q) ||
          r.variant_code.toLowerCase().includes(q) ||
          (r.linea?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [rows, tab, search])

  const counts: Record<Tab, number> = {
    all: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    archived: rows.filter((r) => r.status === 'archived').length,
  }

  // Agrupar por línea, respetando el orden de `lineas` (sort_order desde DB).
  // Modelos sin línea van al final como "Sin línea".
  const grouped = useMemo(() => {
    const buckets = new Map<string, HouseCatalogRow[]>()
    for (const row of filtered) {
      const key = row.linea ?? '__none__'
      const arr = buckets.get(key) ?? []
      arr.push(row)
      buckets.set(key, arr)
    }

    const ordered: { linea: string; rows: HouseCatalogRow[] }[] = []
    // Primero las líneas conocidas, en su sort_order
    for (const l of lineas) {
      const r = buckets.get(l.name)
      if (r && r.length > 0) {
        ordered.push({ linea: l.name, rows: r })
        buckets.delete(l.name)
      }
    }
    // Luego cualquier línea no listada (datos huérfanos), alfabético
    const remaining = [...buckets.entries()]
      .filter(([k]) => k !== '__none__')
      .sort(([a], [b]) => a.localeCompare(b))
    for (const [k, r] of remaining) {
      ordered.push({ linea: k, rows: r })
    }
    // Sin línea al final
    const none = buckets.get('__none__')
    if (none && none.length > 0) {
      ordered.push({ linea: 'Sin línea', rows: none })
    }
    return ordered
  }, [filtered, lineas])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        {/* Tabs */}
        <div className="flex gap-1 border border-[#E8E8E5] rounded-full p-1 bg-[#F7F7F5] flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest transition-colors ${
                tab === t.id
                  ? 'bg-[#ff003d] text-white shadow-sm'
                  : 'text-neutral-500 hover:text-[#ff003d]'
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 ${
                  tab === t.id ? 'text-white/70' : 'text-neutral-400'
                }`}
              >
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o línea…"
          className="flex-1 border border-[#E8E8E5] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors"
        />
      </div>

      {/* Tabla agrupada */}
      {grouped.length === 0 ? (
        <div className="text-sm text-neutral-400 py-16 text-center border border-[#E8E8E5] rounded-xl">
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.linea}>
              <header className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="inline-block w-1.5 h-6 bg-[#ff003d] rounded-full" />
                  <h2 className="text-base font-black uppercase tracking-tight text-neutral-900">
                    {group.linea}
                  </h2>
                </div>
                <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-mono">
                  {group.rows.length}{' '}
                  {group.rows.length === 1 ? 'modelo' : 'modelos'}
                </span>
              </header>
              <div className="border border-[#E8E8E5] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <TableHead />
                  <tbody className="divide-y divide-[#E8E8E5]">
                    {group.rows.map((row) => (
                      <ModelRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
