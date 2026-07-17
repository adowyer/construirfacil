/**
 * lib/engagement/emit-event.ts
 *
 * Productor de eventos de engagement: CF → n8n. Un solo lugar, tipado.
 *
 * CF emite eventos CRUDOS; n8n (el orquestador) hace el JOIN a marcas.plan y
 * decide el segmento y la secuencia. La lógica de ruteo vive en el workflow de
 * n8n (código determinístico), NO en el prompt del agente. Ver docs/engagement/DESIGN.md.
 *
 *   otp_verified                          → Segmento A (curioso que se registró)
 *   lead_created + marca_id null          → Segmento D (marketplace sin marca)
 *   lead_created + marca.plan 'cf_ximia'  → Segmento B (precalifica Ximia)
 *   lead_created + marca.plan 'cf'        → Segmento C (bienvenida + SLA 48h)
 *
 * Garantías (en código):
 *   - NUNCA tira error: si el webhook falla o no está configurado, loguea y
 *     sigue. Emitir un evento jamás debe romper la respuesta al usuario
 *     (verificar OTP / registrar un lead tienen que andar aunque n8n esté caído).
 *   - Timeout acotado (3s) para no colgar la request si n8n no responde.
 *   - Sin URL configurada → no-op + warning (dev anda sin n8n).
 *
 * Env:
 *   N8N_ENGAGEMENT_WEBHOOK_URL  — webhook del workflow de engagement en n8n.
 *   N8N_ENGAGEMENT_SECRET       — opcional; si está, va como Bearer para que n8n valide el origen.
 */

export type EngagementEvent =
  | {
      event: 'otp_verified'
      email: string
      source: 'catalog'
    }
  | {
      event: 'lead_created'
      lead_id: string
      email: string | null
      source: string
      lead_type: string
      marca_id: string | null
      model_slug: string | null
    }

const TIMEOUT_MS = 3000

/**
 * Emite un evento de engagement a n8n. Best-effort: resuelve siempre (nunca
 * rechaza). El caller puede `await`-earlo (entrega acotada a 3s) o `void`-earlo.
 */
export async function emitEngagementEvent(evt: EngagementEvent): Promise<void> {
  const url = process.env.N8N_ENGAGEMENT_WEBHOOK_URL
  if (!url) {
    console.warn(
      `[engagement] N8N_ENGAGEMENT_WEBHOOK_URL no configurada — evento "${evt.event}" no emitido`,
    )
    return
  }

  const secret = process.env.N8N_ENGAGEMENT_SECRET
  const body = JSON.stringify({ ...evt, occurred_at: new Date().toISOString() })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`[engagement] webhook respondió ${res.status} para "${evt.event}"`)
    }
  } catch (e) {
    // Incluye AbortError (timeout) y errores de red. Nunca propagamos.
    console.error(
      `[engagement] fallo emitiendo "${evt.event}":`,
      e instanceof Error ? e.message : e,
    )
  } finally {
    clearTimeout(timer)
  }
}
