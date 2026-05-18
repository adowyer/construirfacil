/**
 * app/cotizar/page.tsx
 *
 * Página de conversión. Es la ÚNICA conversión medible (escribe a `leads`
 * con atribución de campaña). Si el visitante viene de una campaña, la
 * cookie cf_camp nos da la localidad para pre-cargarla (continuidad de
 * message-match). noindex: es destino de tráfico pago, no de SEO orgánico.
 */

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import SiteHeader from '@/components/SiteHeader'
import { LeadForm } from '@/components/LeadForm'
import { createClient } from '@/lib/supabase/server'
import { getCampaignBySlug } from '@/lib/supabase/queries/campaigns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pedí tu cotización — ConstruirFácil',
  description:
    'Dejanos tus datos y un asesor te contacta para avanzar con tu casa industrializada llave en mano.',
  robots: { index: false, follow: true },
}

export default async function CotizarPage() {
  const cookieStore = await cookies()
  const slug = cookieStore.get('cf_camp')?.value ?? null

  let defaultLocalidad: string | null = null
  if (slug) {
    const supabase = await createClient()
    const campaign = await getCampaignBySlug(supabase, slug)
    defaultLocalidad = campaign?.localidad ?? null
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-16 sm:py-24">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff003d] font-semibold mb-3">
          Tu casa, sin vueltas
        </p>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-[1.05]">
          Pedí tu cotización
        </h1>
        <p className="text-white/55 mt-4 mb-10 max-w-md">
          Un asesor te contacta para diseñar la casa que podés pagar —
          llave en mano, con financiación. Sin compromiso.
        </p>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8">
          <LeadForm defaultLocalidad={defaultLocalidad} />
        </div>
      </main>
    </div>
  )
}
