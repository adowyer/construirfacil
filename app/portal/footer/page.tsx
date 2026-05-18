/**
 * app/portal/footer/page.tsx
 * "Mi footer" — la marca administra sus cards del marquee inferior. Sin
 * cards → el catálogo usa el fallback por defecto.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { getFooterCardsForMarcaAll } from '@/lib/supabase/queries/footer'

export default async function PortalFooterPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const cards = await getFooterCardsForMarcaAll(supabase, marca.id)

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Mi footer
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        Las cards del cierre del catálogo de tu marca (garantía, m²,
        financiación, etc.). Si no cargás ninguna, se usa el set por defecto.
      </p>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500">
          Tus cards ({cards.length})
        </h2>
        <Link
          href="/portal/footer/new"
          className="bg-black text-white px-5 py-2 text-xs font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          Agregar card
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Sin cards — el catálogo usa el set por defecto.
        </p>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {cards.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {c.number_text}
                  {c.unit_text ? ` ${c.unit_text}` : ''}
                </p>
                <p className="text-xs text-neutral-400 truncate">
                  {c.label_text} · orden {c.sort_order}
                  {c.status !== 'active' ? ` · ${c.status}` : ''}
                </p>
              </div>
              <Link
                href={`/portal/footer/${c.id}`}
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
