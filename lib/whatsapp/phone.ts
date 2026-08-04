/**
 * lib/whatsapp/phone.ts
 *
 * Normalización de teléfonos para matchear un número de WhatsApp contra `leads.phone`.
 *
 * ⚠️ La regla es LOS ÚLTIMOS 8 DÍGITOS, y no es arbitraria: es exactamente la misma que
 * `norm_phone()` en `scripts/sync_hubspot_to_supabase.py`. Si acá se usara otra, tendríamos
 * dos implementaciones del mismo criterio conviviendo — el patrón que ya costó caro con
 * `qualify_leads.sql` (segunda implementación de la calificación, divergió en silencio).
 *
 * Por qué 8 y no el número completo: los teléfonos de esta base vienen de OCR de fichas
 * manuscritas, de HubSpot cargado a mano y de formularios web. Traen 0 y 15 de más, con y
 * sin código de país, con y sin guiones. Los últimos 8 son lo único estable.
 *
 * Contrapartida ACEPTADA: 8 dígitos pueden colisionar entre localidades distintas. Por eso
 * quien use esto para ACTUAR sobre un lead debe exigir candidato ÚNICO (misma disciplina que
 * la escalera de match del sync). Ante empate: no adivinar.
 */

/** Solo los dígitos. */
export function digits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Clave de matcheo: últimos 8 dígitos, o null si no hay suficientes.
 * null significa "este teléfono no sirve para matchear", NO "no coincide".
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = digits(raw)
  return d.length >= 8 ? d.slice(-8) : null
}
