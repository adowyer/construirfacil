/**
 * app/admin/campanas/[id]/page.tsx
 * Editor de una campaña + generador de links UTM por medio + eliminar.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCampaignById } from '@/lib/supabase/queries/campaigns'
import { updateCampaign } from '@/app/admin/campanas/actions'
import { CampaignForm } from '@/components/admin/CampaignForm'
import { CampaignUtmGenerator } from '@/components/admin/CampaignUtmGenerator'
import { DeleteCampaignButton } from '@/components/admin/DeleteCampaignButton'

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const campaign = await getCampaignById(supabase, id)
  if (!campaign) notFound()

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
        <span className="text-black">{campaign.localidad}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {campaign.localidad}
          </h1>
          <p className="text-xs text-neutral-400 mt-2 font-mono">
            /casa-financiada/{campaign.slug}
          </p>
        </div>
        <DeleteCampaignButton
          id={campaign.id}
          slug={campaign.slug}
          name={campaign.localidad}
        />
      </div>

      <div className="mb-8">
        <CampaignUtmGenerator slug={campaign.slug} />
      </div>

      <CampaignForm
        action={updateCampaign.bind(null, campaign.id)}
        defaultValues={campaign}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
