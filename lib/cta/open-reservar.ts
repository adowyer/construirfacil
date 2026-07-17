/**
 * lib/cta/open-reservar.ts
 *
 * Puente client-side entre los CTAs "Cotizar" del catálogo (ModelRow,
 * ExpandedPanels, HeroRow) y el `ReservarModal` global montado por
 * `CatalogPage`. Reemplaza los `mailto:cotizar@hausind.com` que salían
 * desde el cliente de mail del visitante — ahora el lead se captura en
 * DB vía `submitLead` (con anti-spam Fase 1: honeypot + Turnstile +
 * rate-limit).
 *
 * Uso:
 *   <button onClick={() => openReservarModal({ model, variante, ... })}>
 *     Cotizar
 *   </button>
 *
 * `CatalogPage` escucha el evento globalmente. Si el catálogo no está
 * montado (rutas legales, admin), el evento no tiene efecto — nadie
 * escucha. En esos contextos no debería haber CTAs "Cotizar" tampoco.
 */

import type { ReservarContext } from '@/components/catalog/ReservarModal'

export const RESERVAR_OPEN_EVENT = 'cf:reservar:open'

/** Abre el ReservarModal global con el context provisto. */
export function openReservarModal(context: ReservarContext): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ReservarContext>(RESERVAR_OPEN_EVENT, { detail: context }),
  )
}
