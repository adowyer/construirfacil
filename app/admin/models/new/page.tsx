/**
 * app/admin/models/new/page.tsx
 * Crear una nueva entrada en `house_catalog`.
 */

import Link from 'next/link'
import { ModelForm } from '@/components/admin/ModelForm'
import { AttributeSelector } from '@/components/admin/AttributeSelector'
import { createModel } from '@/app/admin/models/actions'
import { createClient } from '@/lib/supabase/server'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { getAllLineas } from '@/lib/supabase/queries/lineas'
import { getAttributeTypesWithValues } from '@/lib/supabase/queries/attributes'
import { ChevronRight, ListChecks } from 'lucide-react'

const MODEL_FORM_ID = 'model-new-form'

export default async function NewModelPage() {
  const supabase = await createClient()

  const [marcas, lineas, attributeTypes] = await Promise.all([
    getAllMarcas(supabase),
    getAllLineas(supabase),
    getAttributeTypesWithValues(supabase),
  ])

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 text-xs text-neutral-400 uppercase tracking-widest mb-6">
        <Link href="/admin/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-black">Nuevo modelo</span>
      </div>

      <h1 className="text-4xl font-black uppercase tracking-tight mb-10 pb-6 border-b border-neutral-200">
        Nuevo modelo
      </h1>

      <ModelForm
        action={createModel}
        marcas={marcas.map((m) => ({ id: m.id, name: m.name }))}
        lineas={lineas.map((l) => ({
          id: l.id,
          marca_id: l.marca_id,
          name: l.name,
          sort_order: l.sort_order,
        }))}
        formId={MODEL_FORM_ID}
        submitLabel="Crear modelo"
      />

      {/* ── Atributos al final, atado al form via form="…" ──────────── */}
      <section className="mt-20">
        <header className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm">
            <ListChecks className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              Atributos
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Equipamiento y propiedades. Se guardan al hacer clic en
              &ldquo;Crear modelo&rdquo;.
            </p>
          </div>
        </header>

        <div className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
          <AttributeSelector
            attributeTypes={attributeTypes}
            selectedValueIds={[]}
            formId={MODEL_FORM_ID}
          />
        </div>
      </section>
    </div>
  )
}
