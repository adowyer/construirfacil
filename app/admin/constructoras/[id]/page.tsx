/**
 * app/admin/constructoras/[id]/page.tsx
 * Admin review page for a single constructora — approve or reject.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConstructoraById } from '@/lib/supabase/queries/constructoras'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminConstructoraReviewPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const constructora = await getConstructoraById(supabase, id)

  if (!constructora) notFound()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function approve(_formData: FormData) {
    'use server'
    const { id: constructoraId } = await params
    const adminSupabase = createAdminClient()
    const serverSupabase = await createClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()

    await adminSupabase
      .from('constructoras')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
        rejection_reason: null,
      })
      .eq('id', constructoraId)

    redirect('/admin/constructoras')
  }

  async function reject(formData: FormData) {
    'use server'
    const { id: constructoraId } = await params
    const reason = formData.get('rejection_reason') as string
    const adminSupabase = createAdminClient()

    await adminSupabase
      .from('constructoras')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', constructoraId)

    redirect('/admin/constructoras')
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/constructoras" className="hover:text-black transition-colors">
          Constructoras
        </Link>
        {' / '}
        <span className="text-black">{constructora.name}</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-8">
        {constructora.name}
      </h1>

      <dl className="space-y-4 border border-neutral-200 p-6 mb-8">
        {[
          { label: 'Estado actual', value: constructora.status },
          { label: 'Provincia', value: constructora.province ?? '—' },
          { label: 'Ciudad', value: constructora.city ?? '—' },
          { label: 'Teléfono', value: constructora.phone ?? '—' },
          { label: 'Sitio web', value: constructora.website_url ?? '—' },
          { label: 'Descripción', value: constructora.description ?? '—' },
          {
            label: 'Registrada',
            value: new Date(constructora.created_at).toLocaleString('es-AR'),
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex gap-8">
            <dt className="text-xs uppercase tracking-widest text-neutral-400 w-32 flex-shrink-0 pt-0.5">
              {label}
            </dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Actions */}
      <div className="flex gap-4">
        {constructora.status !== 'approved' && (
          <form action={approve}>
            <button
              type="submit"
              className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              Aprobar
            </button>
          </form>
        )}

        {constructora.status !== 'rejected' && (
          <form action={reject} className="flex gap-3">
            <input
              type="text"
              name="rejection_reason"
              placeholder="Motivo del rechazo (opcional)"
              className="border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors w-64"
            />
            <button
              type="submit"
              className="border border-red-600 text-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors"
            >
              Rechazar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
