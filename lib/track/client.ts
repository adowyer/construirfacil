/**
 * lib/track/client.ts
 *
 * Beacon de primera-parte. Lo llaman client components (ModelRow,
 * CampaignTracker). Usa sendBeacon (sobrevive a la navegación / cierre de
 * tab); fallback a fetch keepalive. NUNCA rompe la UI: todo en try/catch.
 *
 * El server (/api/track) resuelve la atribución (campaña + utm) desde el
 * path y las cookies cf_sid/cf_camp/cf_utm — el cliente sólo manda la señal.
 */

export type TrackEvent =
  | 'landing_view'
  | 'model_open'
  | 'cotizar_open'
  | 'whatsapp_click'
  | 'lead'

export function track(
  event: TrackEvent,
  meta?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      event,
      path: window.location.pathname,
      search: window.location.search,
      referrer: document.referrer || null,
      meta: meta ?? null,
    })
    const url = '/api/track'
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([body], { type: 'application/json' }),
      )
    } else {
      void fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      })
    }
  } catch {
    /* el tracking nunca debe romper la experiencia */
  }
}
