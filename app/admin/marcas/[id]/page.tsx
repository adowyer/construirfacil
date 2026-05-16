/**
 * app/admin/marcas/[id]/page.tsx
 * Página admin de detalle/edit de una marca: form de edición de campos +
 * acciones de moderación (aprobar / rechazar) + delete.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMarcaById } from '@/lib/supabase/queries/marcas'
import { MarcaForm } from '@/components/admin/MarcaForm'
import { MarcaLogoUploader } from '@/components/admin/MarcaLogoUploader'
import { MarcaIsoUploader } from '@/components/admin/MarcaIsoUploader'
import { DeleteMarcaButton } from '@/components/admin/DeleteMarcaButton'
import {
  approveMarca,
  rejectMarca,
  updateMarca,
} from '@/app/admin/marcas/actions'
import type { MarcaStatus } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<MarcaStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_CLASSES: Record<MarcaStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function AdminMarcaEditPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const marca = await getMarcaById(supabase, id)

  if (!marca) notFound()

  const updateMarcaWithId = updateMarca.bind(null, id)
  const approveAction = approveMarca.bind(null, id)
  const rejectAction = rejectMarca.bind(null, id)

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/marcas" className="hover:text-black transition-colors">
          Marcas
        </Link>
        <span>/</span>
        <span className="text-black">{marca.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {marca.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`text-[11px] uppercase tracking-widest px-2 py-1 ${STATUS_CLASSES[marca.status]}`}
            >
              {STATUS_LABELS[marca.status]}
            </span>
            <span className="text-xs text-neutral-400">
              Registrada{' '}
              {new Date(marca.created_at).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <DeleteMarcaButton id={id} name={marca.name} />
      </div>

      {/* Rejection reason banner */}
      {marca.status === 'rejected' && marca.rejection_reason && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
          <strong>Motivo del rechazo:</strong> {marca.rejection_reason}
        </div>
      )}

      {/* Identidad visual — isologo (logo_url) e isotipo (iso_url), activos
          independientes. */}
      <section className="mb-10 space-y-4">
        <h2 className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
          Identidad visual
        </h2>
        <MarcaLogoUploader
          marcaId={id}
          marcaName={marca.name}
          initialLogoUrl={marca.logo_url}
        />
        <MarcaIsoUploader
          marcaId={id}
          marcaName={marca.name}
          initialIsoUrl={marca.iso_url}
        />
      </section>

      {/* Edit form */}
      <MarcaForm
        action={updateMarcaWithId}
        defaultValues={marca}
        submitLabel="Guardar cambios"
      />

      {/* ── Moderación ──────────────────────────────────────────── */}
      <section className="mt-16 border-t border-neutral-200 pt-10">
        <h2 className="text-xl font-black uppercase tracking-tight mb-6">
          Moderación
        </h2>

        <div className="flex flex-wrap gap-6 items-start">
          {marca.status !== 'approved' && (
            <form action={approveAction}>
              <button
                type="submit"
                className="bg-[#ff003d] text-white px-[27px] py-[5px] text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors rounded-full"
              >
                Aprobar
              </button>
            </form>
          )}

          {marca.status !== 'rejected' && (
            <form action={rejectAction} className="flex gap-3">
              <input
                type="text"
                name="rejection_reason"
                placeholder="Motivo del rechazo (opcional)"
                className="border border-neutral-300 px-[27px] py-[5px] text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors w-64 rounded-full"
              />
              <button
                type="submit"
                className="border border-red-600 text-red-600 px-[27px] py-[5px] text-sm font-semibold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors rounded-full"
              >
                Rechazar
              </button>
            </form>
          )}

          {marca.status === 'approved' && (
            <p className="text-sm text-neutral-500">
              Esta marca ya está aprobada. Para revocar, primero rechazala.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
