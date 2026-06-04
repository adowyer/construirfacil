/**
 * app/admin/promos/[id]/page.tsx
 * Form para editar un banner existente. Incluye delete.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { getAllProvincias } from '@/lib/supabase/queries/zones'
import { updatePromo, deletePromo } from '../actions'
import PromoForm, { type PromoInitial } from '../PromoForm'
import type {
  PromoColor,
  PromoCtaAction,
  PromoScope,
} from '@/lib/supabase/queries/promos'

export default async function EditPromoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [marcas, provincias, { data: promo, error }] = await Promise.all([
    getAllMarcas(supabase),
    getAllProvincias(supabase),
    supabase
      .from('promo_messages')
      .select(
        'id, marca_id, provincia_id, scope, titulo, cuerpo, color, cta_label, cta_action, activo, sort_order, starts_at, ends_at',
      )
      .eq('id', id)
      .maybeSingle(),
  ])

  if (error || !promo) {
    notFound()
  }

  const initial: PromoInitial = {
    marca_id: promo.marca_id,
    provincia_id: promo.provincia_id ?? null,
    scope: (promo.scope as PromoScope) ?? 'intermediate',
    titulo: promo.titulo,
    cuerpo: promo.cuerpo,
    color: (promo.color as PromoColor) ?? 'green',
    cta_label: promo.cta_label,
    cta_action: (promo.cta_action as PromoCtaAction) ?? 'none',
    activo: promo.activo,
    sort_order: promo.sort_order,
    starts_at: promo.starts_at,
    ends_at: promo.ends_at,
  }

  // Bind del id a la action — Next 16 acepta .bind() para server actions.
  const boundUpdate = updatePromo.bind(null, id)
  const boundDelete = deletePromo.bind(null, id)

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <Link
            href="/admin/promos"
            className="text-xs underline hover:no-underline text-neutral-500"
          >
            ← Volver a Promos
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight mt-2">
            Editar promo
          </h1>
        </div>
        <form action={boundDelete}>
          <button
            type="submit"
            className="text-xs uppercase tracking-widest text-red-600 hover:underline"
          >
            Borrar
          </button>
        </form>
      </div>

      <PromoForm
        action={boundUpdate}
        marcas={marcas.map((m) => ({ id: m.id, name: m.name }))}
        provincias={provincias}
        initial={initial}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
