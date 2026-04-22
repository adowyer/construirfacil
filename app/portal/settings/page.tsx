/**
 * app/portal/settings/page.tsx
 * Constructora brand settings — edit name, description, location, contact.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'
import ConstructoraSettingsForm from './ConstructoraSettingsForm'

export default async function PortalSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const constructora = await getMyConstructora(supabase, user.id)

  if (!constructora) redirect('/portal/onboarding')

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Mi constructora
      </h1>
      <p className="text-neutral-500 text-sm mb-10">
        Los cambios a tu perfil no requieren nueva aprobación.
      </p>
      <ConstructoraSettingsForm constructora={constructora} />
    </div>
  )
}
