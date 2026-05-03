/**
 * app/portal/models/new/page.tsx
 * Create a new house model.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { getConstructionSystems, getAttributeTypesWithValues } from '@/lib/supabase/queries/attributes'
import ModelForm from '@/components/portal/ModelForm'

export default async function NewModelPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)

  if (!marca) redirect('/portal/onboarding')
  if (marca.status !== 'approved') redirect('/portal')

  const [constructionSystems, attributeTypes] = await Promise.all([
    getConstructionSystems(supabase),
    getAttributeTypesWithValues(supabase),
  ])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        {' / '}
        <span className="text-black">Nuevo modelo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-8">
        Nuevo modelo
      </h1>

      <ModelForm
        marcaId={marca.id}
        constructionSystems={constructionSystems}
        attributeTypes={attributeTypes}
      />
    </div>
  )
}
