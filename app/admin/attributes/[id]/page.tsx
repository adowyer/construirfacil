/**
 * app/admin/attributes/[id]/page.tsx
 * Edit an attribute type.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAttributeTypeById } from '@/lib/supabase/queries/attributes'
import AttributeTypeEditForm from './AttributeTypeEditForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminAttributeEditPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const type = await getAttributeTypeById(supabase, id)

  if (!type) notFound()

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/attributes" className="hover:text-black transition-colors">
          Atributos
        </Link>
        {' / '}
        <span className="text-black">{type.name}</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        {type.name}
      </h1>
      <Link
        href={`/admin/attributes/${type.id}/values`}
        className="text-sm underline hover:no-underline text-neutral-500 mb-8 inline-block"
      >
        Gestionar valores ({type.attribute_values.length})
      </Link>

      <AttributeTypeEditForm type={type} />
    </div>
  )
}
