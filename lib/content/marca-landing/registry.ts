/**
 * lib/content/marca-landing/registry.ts
 *
 * Mapa slug → contenido editorial. La página /marcas/[slug] consulta
 * este registry: si encuentra entry, renderiza la landing rica;
 * si no, cae al layout fallback (logo + grid simple).
 */

import type { MarcaLandingContent } from './types'
import { hausindContent } from './hausind'

export const marcaLandingRegistry: Record<string, MarcaLandingContent> = {
  hausind: hausindContent,
}

export function getMarcaLandingContent(
  slug: string,
): MarcaLandingContent | null {
  return marcaLandingRegistry[slug] ?? null
}
