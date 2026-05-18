/**
 * app/portal/footer/[id]/page.tsx
 * Edición de una card del footer de la marca (propiedad verificada).
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { getFooterCardById } from '@/lib/supabase/queries/footer'
import { FooterCardForm } from '@/components/admin/FooterCardForm'
import { DeleteMyFooterCardButton } from '../DeleteMyFooterCardButton'
import { updateMyFooterCard } from '../actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PortalEditFooterCardPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const { id } = await params
  const card = await getFooterCardById(supabase, id)
  if (!card || card.marca_id !== marca.id) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/footer" className="hover:text-black transition-colors">
          Mi footer
        </Link>
        <span>/</span>
        <span className="text-black">{card.number_text}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          {card.number_text}
          {card.unit_text ? ` ${card.unit_text}` : ''}
        </h1>
        <DeleteMyFooterCardButton id={card.id} name={card.number_text} />
      </div>

      <FooterCardForm
        action={updateMyFooterCard.bind(null, card.id)}
        lockMarca={{ id: marca.id, name: marca.name }}
        defaultValues={card}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
