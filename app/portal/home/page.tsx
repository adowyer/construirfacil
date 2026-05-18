/**
 * app/portal/home/page.tsx
 * "Mi presentación inferior" — la marca edita su HomeRow. 5 slots; sin
 * contenido cargado cada slot usa el default.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import {
  getMyHomeSlides,
  HOME_SLIDE_KEYS,
} from '@/lib/supabase/queries/home_content'
import { HOME_TEXT_DEFAULTS } from '@/lib/content/home-defaults'

export default async function PortalHomeRowPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const mine = await getMyHomeSlides(supabase, marca.id)
  const byKey = new Map(mine.map((s) => [s.slide_key, s]))

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Mi presentación inferior
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        El slider de beneficios debajo del principal. Si no cargás un slot, se
        muestra el contenido por defecto.
      </p>

      <div className="border border-neutral-200 divide-y divide-neutral-200">
        {HOME_SLIDE_KEYS.map((key, i) => {
          const row = byKey.get(key)
          const name = HOME_TEXT_DEFAULTS[key].b2c.label
          return (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Slot {i + 1}{' '}
                  <span className="text-xs text-neutral-400 font-normal">
                    ({name})
                  </span>
                </p>
                {row?.label && (
                  <p className="text-xs text-neutral-400 truncate">
                    “{row.label}”
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs uppercase tracking-widest text-neutral-400">
                  {row ? 'Propio' : 'Default'}
                </span>
                <Link
                  href={`/portal/home/${key}`}
                  className="text-xs underline hover:no-underline"
                >
                  Editar
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
