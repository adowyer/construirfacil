/**
 * app/admin/footer/[id]/page.tsx
 * Edit + delete de una footer card.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFooterCardById } from '@/lib/supabase/queries/footer'
import { FooterCardForm } from '@/components/admin/FooterCardForm'
import { updateFooterCard, deleteFooterCard } from '@/app/admin/footer/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFooterCardPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const item = await getFooterCardById(supabase, id)
  if (!item) notFound()

  const { data: marcas } = await supabase
    .from('marcas')
    .select('id, name')
    .order('name')

  const updateAction = updateFooterCard.bind(null, id)
  const handleDelete = async () => {
    'use server'
    await deleteFooterCard(id)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/footer" className="hover:text-black transition-colors">
          Footer cards
        </Link>
        <span>/</span>
        <span className="text-black">{item.number_text}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {item.number_text}
            {item.unit_text ? <span className="text-neutral-400"> {item.unit_text}</span> : null}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            {item.label_text}
            {' · '}
            actualizado{' '}
            {new Date(item.updated_at).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <form action={handleDelete}>
          <button
            type="submit"
            className="text-xs uppercase tracking-widest text-red-600 hover:text-red-700 underline"
          >
            Eliminar
          </button>
        </form>
      </div>

      <FooterCardForm
        action={updateAction}
        defaultValues={item}
        marcas={(marcas ?? []) as { id: string; name: string }[]}
        submitLabel="Guardar"
      />
    </div>
  )
}
