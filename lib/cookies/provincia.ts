/**
 * lib/cookies/provincia.ts
 *
 * Helpers de cookie `cf-provincia-id` (UUID de public.provincias.id).
 * No es httpOnly: el provider client la lee/escribe directo desde JS.
 *
 * Reemplaza el uso histórico de localStorage `cf-provincia-id` (que solo
 * vivía en el cliente). La cookie permite que el SSR de root layout decida
 * si renderizar el modal de onboarding desde el primer paint.
 */

export const PROVINCIA_COOKIE = 'cf-provincia-id'
export const PROVINCIA_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 año

/** Setea / borra la cookie. Solo client-side. */
export function setProvinciaCookieClient(value: string | null): void {
  if (typeof document === 'undefined') return
  const base = `${PROVINCIA_COOKIE}=${value ?? ''}; path=/; SameSite=Lax`
  if (value === null) {
    document.cookie = `${base}; max-age=0`
  } else {
    document.cookie = `${base}; max-age=${PROVINCIA_COOKIE_MAX_AGE}`
  }
}

/** Lee la cookie en el cliente. */
export function getProvinciaCookieClient(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PROVINCIA_COOKIE}=([^;]+)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}
