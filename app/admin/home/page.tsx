/**
 * app/admin/home/page.tsx
 * Admin CF del HomeRow (slider inferior). Selector B2C/B2B + los 5 slots.
 * Sin fila → el slot usa su default (cero cambio visual).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getAllHomeSlidesCF,
  HOME_SLIDE_KEYS,
  type HomeVariant,
} from '@/lib/supabase/queries/home_content'
import { HOME_TEXT_DEFAULTS } from '@/lib/content/home-defaults'

interface PageProps {
  searchParams: Promise<{ scope?: string }>
}

export default async function AdminHomePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const [slides, sp] = await Promise.all([
    getAllHomeSlidesCF(supabase),
    searchParams,
  ])
  const scope: HomeVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'
  const byKey = new Map(
    slides.filter((s) => s.variant === scope).map((s) => [s.slide_key, s]),
  )
  const banners = slides.filter(
    (s) => s.variant === scope && s.slide_key === 'banner',
  )

  const tab = (v: HomeVariant, label: string) => (
    <Link
      href={`/admin/home?scope=${v}`}
      className={`px-5 py-2 text-sm font-semibold uppercase tracking-widest rounded-full transition-colors ${
        scope === v
          ? 'bg-[#ff003d] text-white'
          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          HomeRow (slider inferior)
        </h1>
        <p className="text-xs text-neutral-400 mt-2">
          5 slots. B2B hereda B2C hasta que edites B2B. Sin contenido cargado,
          cada slot usa su texto/estilo por defecto.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {tab('b2c', 'B2C — /')}
        {tab('b2b', 'B2B — /empresas')}
      </div>

      <div className="border border-neutral-200 divide-y divide-neutral-200">
        {HOME_SLIDE_KEYS.map((key, i) => {
          const row = byKey.get(key)
          const name = HOME_TEXT_DEFAULTS[key][scope].label
          return (
            <div
              key={key}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  Slot {i + 1}{' '}
                  <span className="text-xs text-neutral-400 font-normal">
                    ({name})
                  </span>
                </p>
                {row?.label && (
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">
                    “{row.label}”
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[11px] uppercase tracking-widest text-neutral-400">
                  {row ? (row.status === 'active' ? 'Activo' : row.status) : 'Default'}
                </span>
                <Link
                  href={`/admin/home/${key}?scope=${scope}`}
                  className="text-xs underline hover:no-underline"
                >
                  Editar
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Banners (repetibles) */}
      <div className="flex items-center justify-between mb-3 mt-12">
        <h2 className="text-[11px] uppercase tracking-widest text-neutral-400">
          Banners · {scope.toUpperCase()} ({banners.length})
        </h2>
        <Link
          href={`/admin/home/new-banner?scope=${scope}`}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Agregar banner
        </Link>
      </div>
      {banners.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Sin banners. Sumá promos o contenido extra al slider inferior.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {banners.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {b.admin_label || b.label || '(banner sin título)'}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {b.narrow ? 'chico' : 'grande'} ·{' '}
                  {b.image_url ? 'foto' : 'color'} · orden {b.sort_order}
                </p>
              </div>
              <Link
                href={`/admin/home/${b.id}?scope=${scope}`}
                className="text-xs underline hover:no-underline"
              >
                Editar
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
