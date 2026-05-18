/**
 * app/admin/header/page.tsx
 * Admin CF del header (slider HeroRow). Globales (pinned) + selector
 * B2C/B2B con sus singletons y cards de línea. Sin filas → HeroRow usa el
 * hardcoded (cero cambio visual).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getAllHeaderSlidesCF,
  type HeaderSlide,
  type HeaderSlideKind,
  type HeaderVariant,
} from '@/lib/supabase/queries/header_content'
import { DeleteHeaderSlideButton } from '@/components/admin/DeleteHeaderSlideButton'
import { SeedB2BButton } from '@/components/admin/SeedB2BButton'

const STATUS_CLASSES: Record<HeaderSlide['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

const SINGLETONS: { kind: HeaderSlideKind; label: string }[] = [
  { kind: 'crece', label: 'Casa que crece' },
  { kind: 'flex', label: 'Flex Build / Sistema' },
  { kind: 'lineas-intro', label: 'Intro de líneas' },
]
const PINNED: { kind: HeaderSlideKind; label: string }[] = [
  { kind: 'pasos', label: 'Pasos (4 simples pasos)' },
  { kind: 'principal', label: 'Principal (typewriter)' },
]

function StatusPill({ row }: { row: HeaderSlide | undefined }) {
  if (!row)
    return (
      <span className="text-[11px] uppercase tracking-widest px-2 py-1 bg-neutral-100 text-neutral-400">
        Sin cargar (usa default)
      </span>
    )
  return (
    <span
      className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[row.status]}`}
    >
      {row.status === 'active'
        ? 'Activo'
        : row.status === 'inactive'
          ? 'Inactivo'
          : 'Archivado'}
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ scope?: string }>
}

export default async function AdminHeaderPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const [slides, sp] = await Promise.all([
    getAllHeaderSlidesCF(supabase),
    searchParams,
  ])
  const scope: HeaderVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'

  const pinnedByKind = new Map(
    slides.filter((s) => s.is_cf_pinned).map((s) => [s.slide_kind, s]),
  )
  const singletonByKind = new Map(
    slides
      .filter((s) => !s.is_cf_pinned && s.variant === scope)
      .map((s) => [s.slide_kind, s]),
  )
  const lineaCards = slides.filter(
    (s) => !s.is_cf_pinned && s.variant === scope && s.slide_kind === 'linea-card',
  )
  const banners = slides.filter(
    (s) => !s.is_cf_pinned && s.variant === scope && s.slide_kind === 'banner',
  )

  const tab = (v: HeaderVariant, label: string) => (
    <Link
      href={`/admin/header?scope=${v}`}
      className={`px-5 py-2 text-sm font-semibold uppercase tracking-widest rounded-full transition-colors ${
        scope === v
          ? 'bg-[#ff003d] text-white'
          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {label}
    </Link>
  )

  const row = (
    key: string,
    name: string,
    href: string,
    item: HeaderSlide | undefined,
    extra?: React.ReactNode,
  ) => (
    <div key={key} className="flex items-center justify-between px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        {item?.title && (
          <p className="text-xs text-neutral-400 mt-0.5 truncate">
            “{item.title}”
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <StatusPill row={item} />
        {extra}
        <Link href={href} className="text-xs underline hover:no-underline">
          Editar
        </Link>
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Header del catálogo
        </h1>
        <p className="text-xs text-neutral-400 mt-2">
          Slider superior (HeroRow). Si un slide no tiene contenido cargado, el
          catálogo usa su texto/foto por defecto.
        </p>
      </div>

      {/* Globales — pinned, presentes en TODAS las versiones */}
      <h2 className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
        Globales · todas las versiones (solo CF)
      </h2>
      <div className="border border-neutral-200 divide-y divide-neutral-200 mb-12">
        {PINNED.map((p) =>
          row(
            p.kind,
            p.label,
            `/admin/header/${p.kind}`,
            pinnedByKind.get(p.kind),
          ),
        )}
      </div>

      {/* Selector de versión */}
      <div className="flex items-center gap-3 mb-6">
        {tab('b2c', 'B2C — /')}
        {tab('b2b', 'B2B — /empresas')}
        <span className="ml-auto">
          <SeedB2BButton />
        </span>
      </div>

      {/* Singletons de la versión */}
      <h2 className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
        Slides de la versión {scope.toUpperCase()}
      </h2>
      <div className="border border-neutral-200 divide-y divide-neutral-200 mb-10">
        {SINGLETONS.map((s) =>
          row(
            s.kind,
            s.label,
            `/admin/header/${s.kind}?scope=${scope}`,
            singletonByKind.get(s.kind),
          ),
        )}
      </div>

      {/* Cards de línea (repetibles) */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-neutral-400">
          Cards de línea · {scope.toUpperCase()} ({lineaCards.length})
        </h2>
        <Link
          href={`/admin/header/new?scope=${scope}`}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Agregar card
        </Link>
      </div>
      {lineaCards.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Sin cards de línea cargadas — el catálogo usa las líneas por defecto
          (Bosque/Atlas/Terra).
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {lineaCards.map((c) =>
            row(
              c.id,
              c.admin_label || c.title || c.subtitle || '(card sin título)',
              `/admin/header/${c.id}?scope=${scope}`,
              c,
              <span className="text-xs text-neutral-400">
                orden {c.sort_order}
              </span>,
            ),
          )}
        </div>
      )}

      {/* Banners (repetibles) */}
      <div className="flex items-center justify-between mb-3 mt-12">
        <h2 className="text-[11px] uppercase tracking-widest text-neutral-400">
          Banners · {scope.toUpperCase()} ({banners.length})
        </h2>
        <Link
          href={`/admin/header/new-banner?scope=${scope}`}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Agregar banner
        </Link>
      </div>
      {banners.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Sin banners. Agregá promos o contenido extra al slider.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {banners.map((b) =>
            row(
              b.id,
              b.admin_label || b.title || '(banner sin título)',
              `/admin/header/${b.id}?scope=${scope}`,
              b,
              <span className="text-xs text-neutral-400">
                {b.narrow ? 'chico' : 'grande'} · {b.image_url ? 'foto' : 'color'} · orden{' '}
                {b.sort_order}
              </span>,
            ),
          )}
        </div>
      )}
    </div>
  )
}
