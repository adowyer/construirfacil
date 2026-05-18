/**
 * app/portal/header/new/page.tsx
 * Nueva card de línea de la marca. Al crear redirige a su edición (foto).
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { HeaderSlideForm } from '@/components/admin/HeaderSlideForm'
import { createMyLineaCard } from '../actions'

export default async function PortalNewLineaCardPage() {
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
        <Link href="/portal/header" className="hover:text-black transition-colors">
          Mi presentación
        </Link>
        <span>/</span>
        <span className="text-black">Nueva card de línea</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva card de línea
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Después de crearla vas a poder subir la foto de fondo.
      </p>

      <HeaderSlideForm
        action={createMyLineaCard}
        contextLabel="Card de línea · tu marca"
        submitLabel="Crear card"
      />
    </div>
  )
}
