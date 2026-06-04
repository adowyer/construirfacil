/**
 * app/admin/promos/page.tsx
 * Listado de banners promocionales (promo_messages). El founder edita
 * desde acá los banners hero + intermedios que aparecen en el catálogo.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const COLOR_SWATCH: Record<string, string> = {
  red: '#ff003d',
  cyan: '#26b6cf',
  yellow: '#f4a72b',
  green: '#3aa087',
}

const SCOPE_LABEL: Record<string, string> = {
  hero: 'Hero',
  intermediate: 'Intermedio',
}

const ACTION_LABEL: Record<string, string> = {
  none: '—',
  contactar: 'Contactar',
  ximia: 'Ximia',
  saber_mas: 'Saber más',
}

interface PromoRow {
  id: string
  scope: string
  color: string
  titulo: string
  cuerpo: string
  cta_action: string
  cta_label: string | null
  activo: boolean
  sort_order: number
  marca: { name: string } | null
  provincia: { name: string } | null
}

export default async function AdminPromosPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('promo_messages')
    .select(
      'id, scope, color, titulo, cuerpo, cta_action, cta_label, activo, sort_order, marca:marca_id(name), provincia:provincia_id(name)',
    )
    .order('marca_id', { ascending: true })
    .order('sort_order', { ascending: true })

  // Supabase puede tipar la relación como array — normalizamos a objeto.
  type Raw = Omit<PromoRow, 'marca' | 'provincia'> & {
    marca: { name: string } | { name: string }[] | null
    provincia: { name: string } | { name: string }[] | null
  }
  const promos: PromoRow[] = ((data as Raw[] | null) ?? []).map((r) => ({
    ...r,
    marca: Array.isArray(r.marca) ? r.marca[0] ?? null : r.marca,
    provincia: Array.isArray(r.provincia) ? r.provincia[0] ?? null : r.provincia,
  }))

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight mb-6">Promos</h1>
        <p className="text-red-600">Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Promos ({promos.length})
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Banners del catálogo. Eyebrow + flecha + copy, 4 colores CF,
            scope hero (arriba) o intermedio (entre filas).
          </p>
        </div>
        <Link
          href="/admin/promos/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva promo
        </Link>
      </div>

      {promos.length === 0 ? (
        <p className="text-neutral-400">
          No hay banners cargados. Creá la primera con el botón de arriba —
          mientras tanto el catálogo muestra los hero banners hardcoded por
          cohorte Lote.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {promos.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-6 py-4"
              style={{ opacity: p.activo ? 1 : 0.45 }}
            >
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: COLOR_SWATCH[p.color] ?? '#ccc',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-semibold truncate">
                  <span className="text-xs uppercase tracking-widest text-neutral-400 mr-2">
                    {p.titulo}
                  </span>
                  {p.cuerpo}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {p.marca?.name ?? '—'} ·{' '}
                  {p.provincia?.name ?? 'Todas las provincias'} ·{' '}
                  {SCOPE_LABEL[p.scope] ?? p.scope} · CTA:{' '}
                  {ACTION_LABEL[p.cta_action] ?? p.cta_action}
                  {p.cta_label ? ` ("${p.cta_label}")` : ''} · sort{' '}
                  {p.sort_order} · {p.activo ? 'activo' : 'pausado'}
                </p>
              </div>
              <Link
                href={`/admin/promos/${p.id}`}
                className="text-xs underline hover:no-underline flex-shrink-0"
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
