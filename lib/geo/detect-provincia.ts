/**
 * lib/geo/detect-provincia.ts
 *
 * Lee los headers geo de Vercel (`x-vercel-ip-country`, `x-vercel-ip-country-region`)
 * y devuelve el slug de provincia sugerido. Si el visitante no está en AR o
 * el header no es interpretable, devuelve null (el usuario tendrá que elegir
 * a mano en el modal de onboarding).
 *
 * Server-only (next/headers).
 */

import { ISO_AR_TO_SLUG } from './iso-ar'

/**
 * @param headers - Headers de la request (de next/headers o de Request)
 * @returns slug de provincia, o null si no se puede inferir.
 */
export function detectProvinciaSlug(
  headers: { get(name: string): string | null },
): string | null {
  const country = (headers.get('x-vercel-ip-country') ?? '').toUpperCase()
  if (country !== 'AR') return null

  const region = (headers.get('x-vercel-ip-country-region') ?? '').toUpperCase()
  // Vercel devuelve solo la letra ('B', 'R', etc.) o "AR-B". Normalizamos.
  const code = region.startsWith('AR-') ? region.slice(3) : region
  return ISO_AR_TO_SLUG[code] ?? null
}
