/**
 * app/admin/layout.tsx
 * Admin panel shell. Middleware enforces admin role before this layout runs.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { LogOut, UserCircle2 } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/portal')

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7]">
      {/* Header al estilo del catálogo: blanco, generoso, logo CF a la izquierda. */}
      <header className="bg-white border-b border-neutral-200 px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cf_logo_gris.png"
              alt="ConstruirFácil"
              className="h-12 w-auto group-hover:opacity-80 transition-opacity"
            />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 border border-neutral-300 px-[27px] py-[5px] rounded-full font-semibold">
            Panel admin
          </span>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <UserCircle2 className="w-5 h-5 text-neutral-400" />
            <span className="font-medium">
              {profile?.full_name ?? user.email}
            </span>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-neutral-600 hover:text-[#ff003d] transition-colors px-[27px] py-[5px] rounded-full border border-neutral-200 hover:border-[#ff003d]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 min-w-0 px-10 py-10">{children}</main>
      </div>
    </div>
  )
}
