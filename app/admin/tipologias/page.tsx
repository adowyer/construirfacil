/**
 * app/admin/tipologias/page.tsx
 *
 * Admin de la librería de tipologías. Post-0090 hay DOS coexistiendo:
 *
 *   • tipologia_attrs (4 ejes nuevos: circulacion / morfologia / acceso /
 *     area_social). Es lo que va al motor de Ximia y al catálogo nuevo. Se
 *     edita acá por defecto con 4 tabs.
 *
 *   • tipologia_catalog (legacy, single-axis EJES/CUBO/ZETA/DECK). Sigue
 *     vivo porque el catálogo lo usa como fallback cuando el modelo no tiene
 *     los 4 ejes. Se accede vía `?eje=legacy`.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getAllTipologiaAttrs,
  ATTR_EJES,
  ATTR_EJE_LABEL,
  ATTR_EJE_HINT,
  isValidEje,
  type AttrEje,
  type TipologiaAttrRow,
} from '@/lib/supabase/queries/tipologia-attrs'
import { getAllTipologias } from '@/lib/supabase/queries/tipologia'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import type { TipologiaRow } from '@/lib/supabase/queries/tipologia'

type TabKey = AttrEje | 'legacy'

const TAB_KEYS: TabKey[] = [...ATTR_EJES, 'legacy']

const STATUS_LABELS: Record<TipologiaAttrRow['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
}
const STATUS_CLASSES: Record<TipologiaAttrRow['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminTipologiasPage({
  searchParams,
}: {
  searchParams: Promise<{ eje?: string }>
}) {
  const sp = await searchParams
  const requested = sp.eje ?? ''
  const activeTab: TabKey =
    requested === 'legacy'
      ? 'legacy'
      : isValidEje(requested)
        ? requested
        : 'circulacion'

  const supabase = await createClient()
  const [attrs, legacy, marcas] = await Promise.all([
    getAllTipologiaAttrs(supabase),
    getAllTipologias(supabase),
    getAllMarcas(supabase),
  ])
  const marcaName = new Map(marcas.map((m) => [m.id, m.name]))

  // Counts por tab
  const countByEje: Record<AttrEje, number> = {
    circulacion: 0,
    morfologia: 0,
    acceso: 0,
    area_social: 0,
  }
  for (const a of attrs) countByEje[a.eje]++

  const newHref =
    activeTab === 'legacy'
      ? '/admin/tipologias/new'
      : `/admin/tipologias/attrs/new?eje=${activeTab}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Tipologías
          </h1>
          <p className="text-xs text-neutral-400 mt-2 max-w-2xl">
            Librería compartida por todas las marcas. Cada eje aporta una pieza
            del nombre comercial y una línea narrativa que consume Ximia. El
            ámbito "Compartido" lo administra CF; cada marca puede sumar valores
            propios o pisar uno compartido.
          </p>
        </div>
        <Link
          href={newHref}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva
        </Link>
      </div>

      {/* Tabs por eje */}
      <div className="border-b border-neutral-200 mb-6 -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-1">
          {TAB_KEYS.map((tab) => {
            const isActive = tab === activeTab
            const label =
              tab === 'legacy' ? 'Legacy (single-axis)' : ATTR_EJE_LABEL[tab]
            const count =
              tab === 'legacy' ? legacy.length : countByEje[tab as AttrEje]
            return (
              <Link
                key={tab}
                href={`/admin/tipologias?eje=${tab}`}
                className={`px-4 py-2 text-[11px] uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#ff003d] text-[#0a0a0a] font-semibold'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {label}
                <span className="ml-2 text-neutral-400 normal-case tracking-normal">
                  ({count})
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {activeTab === 'legacy' ? (
        <LegacyList items={legacy} marcaName={marcaName} />
      ) : (
        <AttrsList
          eje={activeTab}
          items={attrs.filter((a) => a.eje === activeTab)}
          marcaName={marcaName}
        />
      )}
    </div>
  )
}

function AttrsList({
  eje,
  items,
  marcaName,
}: {
  eje: AttrEje
  items: TipologiaAttrRow[]
  marcaName: Map<string, string>
}) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-4">{ATTR_EJE_HINT[eje]}</p>
      {items.length === 0 ? (
        <p className="text-neutral-400">
          No hay valores cargados para {ATTR_EJE_LABEL[eje]}. El catálogo deja
          el atributo vacío hasta que cargues uno.
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
                  <span className="font-mono">{c.valor}</span>
                  <span className="text-neutral-300 mx-2">·</span>
                  <span className="font-normal text-neutral-700">{c.nombre}</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {c.marca_id ? (
                    <span className="text-neutral-500">
                      Propietario ·{' '}
                      {marcaName.get(c.marca_id) ?? 'marca desconocida'}
                    </span>
                  ) : (
                    <span className="text-neutral-500">Compartido</span>
                  )}
                  {' · '}
                  orden {c.sort_order}
                  {c.descripcion && (
                    <>
                      {' · '}
                      <span className="italic">
                        "{c.descripcion.slice(0, 80)}
                        {c.descripcion.length > 80 ? '…' : ''}"
                      </span>
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
                  href={`/admin/tipologias/attrs/${c.id}`}
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

function LegacyList({
  items,
  marcaName,
}: {
  items: TipologiaRow[]
  marcaName: Map<string, string>
}) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-4">
        Librería legacy (single-axis) — sigue activa porque el catálogo la usa
        como fallback cuando el modelo no tiene los 4 ejes nuevos. Editable
        para marcas/modelos que aún no migraron.
      </p>
      {items.length === 0 ? (
        <p className="text-neutral-400">
          No hay tipologías legacy. El catálogo muestra el raw code de cada SKU.
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
                      Propietario ·{' '}
                      {marcaName.get(c.marca_id) ?? 'marca desconocida'}
                    </span>
                  ) : (
                    <span className="text-neutral-500">Compartido</span>
                  )}
                  {' · '}
                  orden {c.sort_order}
                  {c.descripcion && (
                    <>
                      {' · '}
                      <span className="italic">
                        "{c.descripcion.slice(0, 80)}
                        {c.descripcion.length > 80 ? '…' : ''}"
                      </span>
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
