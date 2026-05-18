/**
 * app/portal/header/page.tsx
 * "Mi presentación" — la marca edita su propio header (slider del catálogo
 * de su marca). Los slides de ConstruirFácil (pasos/principal) se muestran
 * read-only. Sin filas → el catálogo usa el contenido por defecto.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import {
  getMyHeaderSlides,
  getPinnedHeaderSlides,
  type HeaderSlide,
} from '@/lib/supabase/queries/header_content'

const KIND_LABEL: Record<string, string> = {
  pasos: 'Pasos',
  principal: 'Principal',
  crece: 'Casa que crece',
  flex: 'Sistema constructivo',
  'lineas-intro': 'Intro de líneas',
  'linea-card': 'Card de línea',
}

const EDITABLE_SINGLETONS = ['crece', 'flex', 'lineas-intro'] as const

function StatusTag({ row }: { row: HeaderSlide | undefined }) {
  if (!row)
    return (
      <span className="text-xs uppercase tracking-widest text-neutral-400">
        Usa el default
      </span>
    )
  const map: Record<HeaderSlide['status'], string> = {
    active: 'text-green-600',
    inactive: 'text-neutral-400',
    archived: 'text-neutral-400',
  }
  return (
    <span className={`text-xs uppercase tracking-widest ${map[row.status]}`}>
      {row.status === 'active' ? 'Activo' : row.status}
    </span>
  )
}

export default async function PortalHeaderPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const [mine, pinned] = await Promise.all([
    getMyHeaderSlides(supabase, marca.id),
    getPinnedHeaderSlides(supabase),
  ])

  const mineByKind = new Map(
    mine
      .filter((s) => s.slide_kind !== 'linea-card')
      .map((s) => [s.slide_kind, s]),
  )
  const myLineaCards = mine.filter((s) => s.slide_kind === 'linea-card')
  const myBanners = mine.filter((s) => s.slide_kind === 'banner')

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Mi presentación
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        El slider que ve el cliente arriba del catálogo de tu marca. Si no
        cargás un slide, se muestra el contenido por defecto.
      </p>

      {/* CF — read-only */}
      <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
        De ConstruirFácil · no editable
      </h2>
      <div className="border border-neutral-200 divide-y divide-neutral-200 mb-10">
        {pinned.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-400">
            ConstruirFácil todavía no configuró estos slides.
          </p>
        ) : (
          pinned.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {KIND_LABEL[p.slide_kind] ?? p.slide_kind}
                </p>
                {p.title && (
                  <p className="text-xs text-neutral-400 truncate">
                    “{p.title}”
                  </p>
                )}
              </div>
              <span className="text-xs uppercase tracking-widest text-neutral-300">
                Gestionado por CF
              </span>
            </div>
          ))
        )}
      </div>

      {/* Tus slides */}
      <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
        Tus slides
      </h2>
      <div className="border border-neutral-200 divide-y divide-neutral-200 mb-10">
        {EDITABLE_SINGLETONS.map((kind) => {
          const r = mineByKind.get(kind)
          return (
            <div
              key={kind}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{KIND_LABEL[kind]}</p>
                {r?.title && (
                  <p className="text-xs text-neutral-400 truncate">
                    “{r.title}”
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <StatusTag row={r} />
                <Link
                  href={`/portal/header/${kind}`}
                  className="text-xs underline hover:no-underline"
                >
                  Editar
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cards de línea */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500">
          Cards de línea ({myLineaCards.length})
        </h2>
        <Link
          href="/portal/header/new"
          className="bg-black text-white px-5 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          Agregar card
        </Link>
      </div>
      {myLineaCards.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Sin cards de línea — el catálogo usa las líneas por defecto.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {myLineaCards.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {c.admin_label || c.title || c.subtitle || '(card sin título)'}
                </p>
                <p className="text-xs text-neutral-400">orden {c.sort_order}</p>
              </div>
              <Link
                href={`/portal/header/${c.id}`}
                className="text-xs underline hover:no-underline"
              >
                Editar
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Banners (repetibles) */}
      <div className="flex items-center justify-between mb-3 mt-10">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500">
          Banners ({myBanners.length})
        </h2>
        <Link
          href="/portal/header/new-banner"
          className="bg-black text-white px-5 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          Agregar banner
        </Link>
      </div>
      {myBanners.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Sin banners. Sumá promos o contenido extra a tu header.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {myBanners.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {b.admin_label || b.title || '(banner sin título)'}
                </p>
                <p className="text-xs text-neutral-400">
                  {b.narrow ? 'chico' : 'grande'} ·{' '}
                  {b.image_url ? 'foto' : 'color'} · orden {b.sort_order}
                </p>
              </div>
              <Link
                href={`/portal/header/${b.id}`}
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
