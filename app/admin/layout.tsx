/**
 * app/admin/layout.tsx
 * Admin panel shell. Middleware enforces admin role before this layout runs.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-suspenders: middleware already blocks non-admins, but verify here too
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/portal')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-950 text-white">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-black uppercase tracking-tight">
            ConstruirFácil
          </Link>
          <span className="text-xs text-neutral-400 uppercase tracking-widest">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-400">
            {profile?.full_name ?? user.email}
          </span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-neutral-400 hover:text-white transition-colors underline text-xs uppercase tracking-widest"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-56 border-r border-neutral-200 p-6 flex flex-col gap-1 text-sm">
          <Link
            href="/admin"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm font-semibold"
          >
            Dashboard
          </Link>
          <div className="mt-4 mb-1 px-3 text-xs text-neutral-400 uppercase tracking-widest">
            Moderación
          </div>
          <Link
            href="/admin/constructoras"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
          >
            Constructoras
          </Link>
          <Link
            href="/admin/models"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
          >
            Modelos
          </Link>
          <div className="mt-4 mb-1 px-3 text-xs text-neutral-400 uppercase tracking-widest">
            Configuración
          </div>
          <Link
            href="/admin/attributes"
            className="px-3 py-2 hover:bg-neutral-100 transition-colors rounded-sm"
          >
            Atributos
          </Link>
        </nav>

        {/* Main */}
        <main className="flex-1 p-8 max-w-5xl">{children}</main>
      </div>
    </div>
  )
}
