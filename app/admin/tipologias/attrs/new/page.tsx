/**
 * app/admin/tipologias/attrs/new/page.tsx
 * Crear un valor nuevo en tipologia_attrs (4 ejes).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { TipologiaAttrForm } from '@/components/admin/TipologiaAttrForm'
import { createTipologiaAttr } from '@/app/admin/tipologias/attrs/actions'
import {
  isValidEje,
  ATTR_EJE_LABEL,
} from '@/lib/supabase/queries/tipologia-attrs'

export default async function NewTipologiaAttrPage({
  searchParams,
}: {
  searchParams: Promise<{ eje?: string }>
}) {
  const sp = await searchParams
  const presetEje = isValidEje(sp.eje) ? sp.eje : undefined

  const supabase = await createClient()
  const marcas = await getAllMarcas(supabase)
  const approved = marcas
    .filter((m) => m.status === 'approved')
    .map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href={`/admin/tipologias${presetEje ? `?eje=${presetEje}` : ''}`}
          className="hover:text-black transition-colors"
        >
          Tipologías
        </Link>
        <span>/</span>
        <span className="text-black">
          Nuevo{presetEje ? ` · ${ATTR_EJE_LABEL[presetEje]}` : ''}
        </span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nuevo valor de eje
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Eje, valor y ámbito (marca / global) se setean al crear y no se editan
        después — el catálogo público matchea por esa terna.
      </p>

      <TipologiaAttrForm
        action={createTipologiaAttr}
        marcas={approved}
        presetEje={presetEje}
        submitLabel="Crear"
      />
    </div>
  )
}
