/**
 * app/admin/footer/new/page.tsx
 * Crear una nueva footer card desde el panel admin.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FooterCardForm } from '@/components/admin/FooterCardForm'
import { createFooterCard } from '@/app/admin/footer/actions'

export default async function NewFooterCardPage() {
  const supabase = await createClient()
  const { data: marcas } = await supabase
    .from('marcas')
    .select('id, name')
    .order('name')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/footer" className="hover:text-black transition-colors">
          Footer cards
        </Link>
        <span>/</span>
        <span className="text-black">Nueva</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva card de footer
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Cada marca puede definir sus propias cards (Garantía, financiación,
        capacidad, etc). Si no carga ninguna, el catálogo usa el fallback.
      </p>

      <FooterCardForm
        action={createFooterCard}
        marcas={(marcas ?? []) as { id: string; name: string }[]}
        submitLabel="Crear"
      />
    </div>
  )
}
