'use client'

/**
 * components/admin/CatalogTable.tsx
 *
 * Client component: status filter tabs + search + table for house_catalog.
 * Receives the full dataset from the Server Component parent and filters
 * entirely on the client — no round-trip needed for tab/search changes.
 */

import { useState } from 'react'
import Link from 'next/link'
import type { HouseCatalogRow } from '@/lib/supabase/queries/models'
import { ModelRowActions } from './ModelRowActions'

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
// Main component
// ---------------------------------------------------------------------------

export function CatalogTable({ rows }: { rows: HouseCatalogRow[] }) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const filtered = rows.filter((r) => {
    if (tab !== 'all' && r.status !== tab) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.variant_code.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Counts per tab
  const counts: Record<Tab, number> = {
    all: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    archived: rows.filter((r) => r.status === 'archived').length,
  }

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
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-colors ${
                tab === t.id
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 ${
                  tab === t.id ? 'text-neutral-300' : 'text-neutral-400'
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
          placeholder="Buscar por nombre o código…"
          className="flex-1 border border-[#E8E8E5] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-sm text-neutral-400 py-16 text-center border border-[#E8E8E5] rounded-xl">
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        <div className="border border-[#E8E8E5] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E8E5] bg-[#F7F7F5]">
                {[
                  'Código',
                  'Nombre',
                  'Sistema',
                  'Área m²',
                  'Dorm.',
                  'Precio USD',
                  'Estado',
                  '',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] uppercase tracking-widest text-neutral-400 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E5]">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#F7F7F5] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
                    {row.variant_code}
                  </td>
                  <td className="px-4 py-3 font-semibold text-neutral-900 whitespace-nowrap">
                    <Link
                      href={`/admin/models/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">
                    {row.construction_system ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {row.area_m2 != null ? `${row.area_m2} m²` : '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {row.min_bedrooms != null && row.max_bedrooms != null
                      ? row.min_bedrooms === row.max_bedrooms
                        ? String(row.min_bedrooms)
                        : `${row.min_bedrooms}–${row.max_bedrooms}`
                      : (row.min_bedrooms ?? row.max_bedrooms ?? '—')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.public_price_usd != null
                      ? `USD ${row.public_price_usd.toLocaleString('es-AR')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ModelRowActions id={row.id} currentStatus={row.status} />
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
