/**
 * app/portal/header/new-banner/page.tsx
 * La marca crea un banner (slide repetible) para su header.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { BannerForm } from '@/components/admin/BannerForm'
import { createMyHeaderBanner } from '../actions'

export default async function PortalNewHeaderBannerPage() {
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
        <span className="text-black">Nuevo banner</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nuevo banner
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Después de crearlo vas a poder subir la foto de fondo (si querés modo
        foto).
      </p>

      <BannerForm
        action={createMyHeaderBanner}
        contextLabel="Banner · tu marca"
        submitLabel="Crear banner"
      />
    </div>
  )
}
