/**
 * lib/cta/open-ximia.ts
 *
 * Puente cliente-side entre los CTAs "Conversar con Ximia" del catálogo y
 * el `XimiaWidget` global. Cuando el widget está montado en la ruta actual
 * (ver `XIMIA_CATALOG_WIDGET_ENABLED` + gates internos del widget), los CTAs
 * dejan de ser `mailto:` y disparan un evento global que abre el chat inline.
 *
 * Si el widget no está montado / no hay `window` (SSR, tests), el llamado
 * retorna `false` y el CTA cae al fallback `mailto:` (comportamiento previo
 * de `getAsesorHref()`).
 *
 * Uso:
 *   <a href={getAsesorHref()} onClick={handleXimiaCta} …>Conversar con Ximia</a>
 *   → handleXimiaCta hace preventDefault si el widget abrió; si no,
 *   el `href` mailto se sigue disparando y no rompe la UX vieja.
 */

export const XIMIA_OPEN_EVENT = 'cf:ximia:open'

/**
 * Dispara el evento global. Devuelve `true` si el widget respondió
 * (`event.defaultPrevented`), `false` si nadie escucha (widget no montado
 * o script todavía no cargó).
 */
export function requestOpenXimiaWidget(source?: string): boolean {
  if (typeof window === 'undefined') return false
  const evt = new CustomEvent(XIMIA_OPEN_EVENT, {
    cancelable: true,
    detail: { source: source ?? 'unknown' },
  })
  window.dispatchEvent(evt)
  return evt.defaultPrevented
}
