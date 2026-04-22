/**
 * app/portal/layout.tsx
 * Constructora portal shell. Auth is enforced by middleware.tsx — any
 * unauthenticated request to /portal/* is redirected to /login before
 * reaching this layout.
 *
 * This layout:
 *   1. Reads the session and profile server-side (for the nav display name)
 *   2. If the user has no constructora yet, redirects to /portal/onboarding
 *      EXCEPT when already on /portal/onboarding itself
 *   3. Renders the portal chrome (top nav + sidebar)
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getMyConstructora } from '@/lib/supabase/queries/constructoras'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Should not happen — middleware redirects unauthenticated users — but be safe
  if (!user) redirect('/login')

  const [{ data: profile }, constructora] = await Promise.all([
    supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
    getMyConstructora(supabase, user.id),
  ])

  // Read the pathname from headers to know if we're on the onboarding page
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isOnboarding = pathname.startsWith('/portal/onboarding')

  // If the user has no constructora and is not on onboarding, redirect them there
  if (!constructora && !isOnboarding) {
    redirect('/portal/onboarding')
  }

  const displayName = profile?.full_name ?? user.email ?? 'Usuario'
  const constructoraStatus = constructora?.status

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-black uppercase tracking-tight">
            ConstruirFácil
          </Link>
          <span className="text-xs text-neutral-400 uppercase tracking-widest">
            Portal
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">{displayName}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-neutral-400 hover:text-black transition-colors underline text-xs uppercase tracking-widest"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      {/* Constructora status banner */}
      {constructora && constructoraStatus === 'pending' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 text-sm text-yellow-800">
          Tu constructora está pendiente de aprobación. Podrás publicar modelos una vez que sea aprobada.
        </div>
      )}
      {constructora && constructoraStatus === 'rejected' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-800">
          Tu solicitud fue rechazada.
          {constructora.rejection_reason && ` Motivo: ${constructora.rejection_reason}`}
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-56 border-r border-neutral-200 p-6 flex flex-col gap-1 text-sm">
          <Link
            href="/portal"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
          >
            Inicio
          </Link>
          {constructora && constructoraStatus === 'approved' && (
            <>
              <Link
                href="/portal/models"
                className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
              >
                Mis modelos
              </Link>
              <Link
                href="/portal/models/new"
                className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm text-neutral-500"
              >
                + Nuevo modelo
              </Link>
            </>
          )}
          <Link
            href="/portal/settings"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
          >
            Mi constructora
          </Link>
        </nav>

        {/* Main */}
        <main className="flex-1 p-8 max-w-4xl">{children}</main>
      </div>
    </div>
  )
}
