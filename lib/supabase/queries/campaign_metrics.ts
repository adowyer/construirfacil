/**
 * lib/supabase/queries/campaign_metrics.ts
 *
 * Métricas del dashboard (Fase 5). Lee `campaign_event` + `leads` con el
 * cliente service-role (tablas internas, sin grant público). Agrega en JS
 * (acotado por fecha): para el volumen de lanzamiento alcanza; si crece, se
 * migra a una vista/RPC sin tocar el caller.
 *
 * "Visita" = session_id distinto con landing_view. El embudo por banner:
 * visitas → model_open → cotizar_open → leads.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type FunnelRow = {
  key: string
  label: string
  visits: number
  modelOpens: number
  cotizar: number
  leads: number
}

export type CampaignMetrics = {
  sinceDays: number
  totals: Omit<FunnelRow, 'key' | 'label'>
  byLocalidad: FunnelRow[]
  byMedio: FunnelRow[]
}

type EventLite = {
  campaign_slug: string | null
  utm_source: string | null
  session_id: string | null
  event_type: string
}
type LeadLite = { campaign_slug: string | null; utm_source: string | null }

const NO_CAMP = '(sin campaña)'
const NO_MEDIO = '(directo / sin medio)'

function blank(): Omit<FunnelRow, 'key' | 'label'> {
  return { visits: 0, modelOpens: 0, cotizar: 0, leads: 0 }
}

export async function getCampaignMetrics(
  admin: SupabaseClient,
  opts: { sinceDays?: number } = {},
): Promise<CampaignMetrics> {
  const sinceDays = opts.sinceDays ?? 90
  const since = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [{ data: evRows }, { data: leadRows }] = await Promise.all([
    admin
      .from('campaign_event')
      .select('campaign_slug, utm_source, session_id, event_type')
      .gte('created_at', since)
      .limit(100000),
    admin
      .from('leads')
      .select('campaign_slug, utm_source')
      .gte('created_at', since)
      .limit(50000),
  ])

  const events = (evRows ?? []) as EventLite[]
  const leads = (leadRows ?? []) as LeadLite[]

  // Acumuladores por dimensión. visits → set de session_id (distintos).
  type Acc = {
    visitSessions: Set<string>
    modelOpens: number
    cotizar: number
    leads: number
  }
  const mk = (): Acc => ({
    visitSessions: new Set(),
    modelOpens: 0,
    cotizar: 0,
    leads: 0,
  })
  const byLoc = new Map<string, Acc>()
  const byMed = new Map<string, Acc>()
  const totals = mk()

  const bump = (m: Map<string, Acc>, k: string) => {
    let a = m.get(k)
    if (!a) {
      a = mk()
      m.set(k, a)
    }
    return a
  }

  for (const e of events) {
    const loc = e.campaign_slug || NO_CAMP
    const med = e.utm_source || NO_MEDIO
    const aL = bump(byLoc, loc)
    const aM = bump(byMed, med)
    if (e.event_type === 'landing_view') {
      if (e.session_id) {
        aL.visitSessions.add(e.session_id)
        aM.visitSessions.add(e.session_id)
        totals.visitSessions.add(e.session_id)
      }
    } else if (e.event_type === 'model_open') {
      aL.modelOpens++
      aM.modelOpens++
      totals.modelOpens++
    } else if (e.event_type === 'cotizar_open') {
      aL.cotizar++
      aM.cotizar++
      totals.cotizar++
    }
  }

  for (const l of leads) {
    bump(byLoc, l.campaign_slug || NO_CAMP).leads++
    bump(byMed, l.utm_source || NO_MEDIO).leads++
    totals.leads++
  }

  const toRows = (m: Map<string, Acc>): FunnelRow[] =>
    [...m.entries()]
      .map(([key, a]) => ({
        key,
        label: key,
        visits: a.visitSessions.size,
        modelOpens: a.modelOpens,
        cotizar: a.cotizar,
        leads: a.leads,
      }))
      .sort((x, y) => y.leads - x.leads || y.visits - x.visits)

  return {
    sinceDays,
    totals: {
      visits: totals.visitSessions.size,
      modelOpens: totals.modelOpens,
      cotizar: totals.cotizar,
      leads: totals.leads,
    },
    byLocalidad: toRows(byLoc),
    byMedio: toRows(byMed),
  }
}
