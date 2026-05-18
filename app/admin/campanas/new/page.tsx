/**
 * app/admin/campanas/new/page.tsx
 * Alta de una campaña. Tras crearla redirige al editor (donde está el
 * generador de links UTM).
 */

import Link from 'next/link'
import { createCampaign } from '@/app/admin/campanas/actions'
import { CampaignForm } from '@/components/admin/CampaignForm'

export default function NewCampaignPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href="/admin/campanas"
          className="hover:text-black transition-colors"
        >
          Campañas
        </Link>
        <span>/</span>
        <span className="text-black">Nueva</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva campaña
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Después de crearla vas a poder generar el link UTM para cada medio.
      </p>

      <CampaignForm action={createCampaign} submitLabel="Crear campaña" />
    </div>
  )
}
