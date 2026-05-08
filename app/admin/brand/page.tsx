/**
 * app/admin/brand/page.tsx
 * Listado admin de brand_content (textos globales de marca consumidos
 * por el catálogo público).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllBrandContent } from '@/lib/supabase/queries/brand-content'
import type { BrandContentRow } from '@/lib/supabase/queries/brand-content'

const STATUS_LABELS: Record<BrandContentRow['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
}

const STATUS_CLASSES: Record<BrandContentRow['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminBrandContentPage() {
  const supabase = await createClient()
  const items = await getAllBrandContent(supabase)

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Contenido del sitio ({items.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Textos globales del catálogo: concepto, sistemas constructivos,
            valores. Consumidos por home y catálogo público.
          </p>
        </div>
        <Link
          href="/admin/brand/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nuevo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-400">No hay brand_content cargado.</p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {items.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  key{' '}
                  <code className="text-neutral-500">{c.key}</code>
                  {' · '}
                  orden {c.sort_order}
                  {c.title && (
                    <>
                      {' · '}
                      <span className="italic">"{c.title}"</span>
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
                  href={`/admin/brand/${c.id}`}
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
