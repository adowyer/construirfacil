/**
 * app/admin/page.tsx
 * Admin dashboard — overview counts and last 5 added from house_catalog.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Fetch everything we need in parallel
  const [totalResult, byStatusResult, bySystemResult, recentResult] =
    await Promise.all([
      // Total count
      supabase
        .from('house_catalog')
        .select('*', { count: 'exact', head: true }),

      // Count per status
      supabase
        .from('house_catalog')
        .select('status'),

      // Count per construction_system
      supabase
        .from('house_catalog')
        .select('construction_system'),

      // Last 5 added
      supabase
        .from('house_catalog')
        .select('id, name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const total = totalResult.count ?? 0

  // Tally statuses
  const statusRows = byStatusResult.data ?? []
  const byStatus = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  // Tally construction systems
  const systemRows = bySystemResult.data ?? []
  const bySystem = systemRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.construction_system ?? 'Sin sistema'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const systemEntries = Object.entries(bySystem).sort((a, b) => b[1] - a[1])

  const recent = recentResult.data ?? []

  // Status config
  const STATUS_CONFIG = [
    { key: 'active', label: 'Activos', color: 'text-green-700 bg-green-50 border-green-200' },
    { key: 'inactive', label: 'Inactivos', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { key: 'archived', label: 'Archivados', color: 'text-neutral-500 bg-neutral-50 border-neutral-200' },
  ]

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Panel de administración
        </h1>
      </div>

      {/* ── Top stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Link
          href="/admin/models"
          className="border border-[#E8E8E5] p-6 hover:border-black transition-colors rounded-xl block"
        >
          <p className="text-4xl font-black tabular-nums">{total}</p>
          <p className="text-[11px] text-neutral-400 uppercase tracking-widest mt-1">
            Total modelos
          </p>
        </Link>

        {STATUS_CONFIG.map(({ key, label, color }) => (
          <Link
            key={key}
            href="/admin/models"
            className={`border p-6 hover:border-black transition-colors rounded-xl block ${color}`}
          >
            <p className="text-4xl font-black tabular-nums">{byStatus[key] ?? 0}</p>
            <p className="text-[11px] uppercase tracking-widest mt-1 opacity-80">
              {label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── By construction system ── */}
        <div className="border border-[#E8E8E5] rounded-xl p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-4">
            Por sistema constructivo
          </h2>
          {systemEntries.length === 0 ? (
            <p className="text-sm text-neutral-400">Sin datos.</p>
          ) : (
            <div className="space-y-2">
              {systemEntries.map(([system, count]) => (
                <div key={system} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{system}</span>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Last 5 added ── */}
        <div className="border border-[#E8E8E5] rounded-xl p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-4">
            Últimos 5 modelos agregados
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-400">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((row) => (
                <div key={row.id} className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/admin/models/${row.id}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${
                      row.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : row.status === 'inactive'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {row.status === 'active'
                      ? 'Activo'
                      : row.status === 'inactive'
                      ? 'Inactivo'
                      : 'Archivado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/admin/models/new"
          className="bg-black text-white px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          Nuevo modelo
        </Link>
        <Link
          href="/admin/models"
          className="border border-[#E8E8E5] px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest hover:border-black transition-colors"
        >
          Ver todos los modelos
        </Link>
      </div>
    </div>
  )
}
