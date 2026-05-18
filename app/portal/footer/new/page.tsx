/**
 * app/portal/footer/new/page.tsx
 * Nueva card del footer de la marca.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { FooterCardForm } from '@/components/admin/FooterCardForm'
import { createMyFooterCard } from '../actions'

export default async function PortalNewFooterCardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/footer" className="hover:text-black transition-colors">
          Mi footer
        </Link>
        <span>/</span>
        <span className="text-black">Nueva card</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Nueva card del footer
      </h1>

      <FooterCardForm
        action={createMyFooterCard}
        lockMarca={{ id: marca.id, name: marca.name }}
        submitLabel="Crear card"
      />
    </div>
  )
}
