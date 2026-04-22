/**
 * app/admin/attributes/[id]/values/page.tsx
 * Manage attribute values for a given type — add, reorder, delete.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAttributeTypeById } from '@/lib/supabase/queries/attributes'
import AttributeValuesManager from './AttributeValuesManager'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AttributeValuesPage({ params }: PageProps) {
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
        <Link href={`/admin/attributes/${type.id}`} className="hover:text-black transition-colors">
          {type.name}
        </Link>
        {' / '}
        <span className="text-black">Valores</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        {type.name}
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        Valores disponibles para este tipo de atributo.
      </p>

      <AttributeValuesManager type={type} />
    </div>
  )
}
