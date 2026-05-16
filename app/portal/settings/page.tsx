/**
 * app/portal/settings/page.tsx
 * Marca brand settings — edit name, description, location, contact.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import { MarcaLogoUploader } from '@/components/admin/MarcaLogoUploader'
import { MarcaIsoUploader } from '@/components/admin/MarcaIsoUploader'
import MarcaSettingsForm from './MarcaSettingsForm'

export default async function PortalSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)

  if (!marca) redirect('/portal/onboarding')

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Mi marca
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        Los cambios a tu perfil no requieren nueva aprobación.
      </p>

      {/* Identidad visual — isologo e isotipo, activos independientes. */}
      <section className="mb-12 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Identidad visual
        </h2>
        <MarcaLogoUploader
          marcaId={marca.id}
          marcaName={marca.name}
          initialLogoUrl={marca.logo_url}
        />
        <MarcaIsoUploader
          marcaId={marca.id}
          marcaName={marca.name}
          initialIsoUrl={marca.iso_url}
        />
      </section>

      <MarcaSettingsForm marca={marca} />
    </div>
  )
}
