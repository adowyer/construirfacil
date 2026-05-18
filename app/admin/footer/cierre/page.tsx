/**
 * app/admin/footer/cierre/page.tsx
 * Editor CF del cierre + institucional del footer (singleton key='cf').
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFooterContent } from '@/lib/supabase/queries/footer'
import { FooterContentForm } from '@/components/admin/FooterContentForm'
import { upsertFooterContent } from '@/app/admin/footer/actions'

export default async function AdminFooterCierrePage() {
  const supabase = await createClient()
  const content = await getFooterContent(supabase)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/footer" className="hover:text-black transition-colors">
          Footer
        </Link>
        <span>/</span>
        <span className="text-black">Cierre + institucional</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Cierre + institucional
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Texto del cierre y del pie legal del footer, global a todo el sitio.
        Las cards del marquee se administran por marca abajo en Footer.
      </p>

      <FooterContentForm action={upsertFooterContent} defaultValues={content} />
    </div>
  )
}
