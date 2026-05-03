/**
 * app/portal/settings/page.tsx
 * Marca brand settings — edit name, description, location, contact.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
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
      <MarcaSettingsForm marca={marca} />
    </div>
  )
}
