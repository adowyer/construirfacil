/**
 * app/admin/footer/page.tsx
 * Listado admin de footer_card_content agrupado por marca.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllFooterCardsForAdmin } from '@/lib/supabase/queries/footer'

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  archived: 'bg-neutral-200 text-neutral-500',
}

export default async function AdminFooterCardsPage() {
  const supabase = await createClient()
  const cards = await getAllFooterCardsForAdmin(supabase)

  // Agrupamos por marca para que el admin se oriente.
  const groups = new Map<string, typeof cards>()
  for (const c of cards) {
    const key = c.marca_name || '(sin marca)'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Footer cards ({cards.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Cards del marquee inferior del catálogo, editables por marca.
            Si una marca no tiene cards cargadas, el catálogo público usa
            el fallback hardcoded (Garantía / 100% / Fábrica / 50.000 m²).
          </p>
        </div>
        <Link
          href="/admin/footer/new"
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
        >
          Nueva card
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-neutral-400">No hay cards cargadas.</p>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([marcaName, group]) => (
            <section key={marcaName}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {marcaName}
              </h2>
              <div className="border border-neutral-200 divide-y divide-neutral-200">
                {group.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {c.number_text}
                        {c.unit_text ? <span className="text-neutral-500"> {c.unit_text}</span> : null}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {c.label_text}
                        {' · '}orden {c.sort_order}
                        {' · '}icono <code className="text-neutral-500">{c.icon_key}</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span
                        className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[c.status] ?? ''}`}
                      >
                        {c.status}
                      </span>
                      <Link
                        href={`/admin/footer/${c.id}`}
                        className="text-xs underline hover:no-underline"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
