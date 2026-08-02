/**
 * lib/auth/ximia-token.ts
 *
 * Token de IDENTIDAD firmado para el widget de Ximia (X-01 de la auditoría 2026-08-01).
 *
 * POR QUÉ EXISTE
 * --------------
 * El widget postea DESDE EL NAVEGADOR directo al webhook de n8n, con la identidad en el
 * body (`{user_id, email, …}`). El webhook es público y n8n usaba ese `email` crudo para
 * buscar el lead en Postgres → **cualquiera que POSTeara un mail ajeno recibía el perfil de
 * esa persona** (nombre, provincia, lote, ingreso, ahorro, crédito), y además pasaba el gate
 * de auth del agente. Enumerable con una lista de mails.
 *
 * Un secreto estático en el widget no es un secreto (corre en el navegador). La solución es
 * que el SERVIDOR firme la identidad que ya resolvió, y que n8n verifique esa firma antes de
 * tocar la base. Sin token válido el visitante es **anónimo** — que no es un error: un
 * anónimo TIENE que poder conversar, es el producto.
 *
 * MISMO PATRÓN QUE EL RESTO DE LA CASA
 * ------------------------------------
 * HMAC-SHA256 + **domain tag** + hex recortado a 32, igual que `gate-cookie.ts`,
 * `session-cookie.ts`, `click-token.ts` y `unsubscribe-token.ts`. El domain tag `ximia:`
 * hace que estas firmas NO sean intercambiables con las de las cookies: un token de Ximia
 * no puede reusarse como `cf_client` ni al revés.
 *
 * SECRETO SEPARADO (decisión D-X01-3)
 * -----------------------------------
 * Se firma con `XIMIA_IDENTITY_SECRET`, **no** con `CF_GATE_SECRET`. n8n necesita el secreto
 * para VERIFICAR; si fuera el mismo de las cookies, quien tenga acceso a n8n podría FIRMAR
 * una `cf_client` y entrar al catálogo como cualquiera. Sin la env definida no se emite
 * token (el visitante queda anónimo) — nunca se cae a un fallback silencioso.
 *
 * REPLAY (decidido y diferido): el token NO está atado al `sessionId`. Atarlo obligaría al
 * atacante a usar también la sesión de la víctima, pero quien puede robar el token puede
 * robar el sessionId del mismo lugar (misma request, mismo localStorage) → ganancia marginal
 * a cambio de acoplar el arranque del widget. Se acota con TTL corto. Revisar en la auditoría
 * de seguridad previa a publicar.
 */
import { createHmac } from 'node:crypto'

const DOMAIN = 'ximia'
const SEP = '|'

/** 12 h. Cubre una sesión de compra larga sin que un token filtrado sirva para siempre. */
export const XIMIA_TOKEN_TTL_SECONDS = 60 * 60 * 12

export type XimiaIdentity = { user_id: string | null; email: string | null }

/** Sin secreto NO se firma: preferimos anónimo antes que un fallback silencioso. */
function secret(): string | null {
  return process.env.XIMIA_IDENTITY_SECRET || null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(`${DOMAIN}:${payload}`).digest('hex').slice(0, 32)
}

function payloadOf(id: XimiaIdentity, exp: number): string {
  // Ni el uuid ni un email pueden contener '|', así que el split es inequívoco.
  return [id.user_id ?? '', (id.email ?? '').trim().toLowerCase(), String(exp)].join(SEP)
}

/**
 * Emite `user_id|email|exp|hmac`, o null si no hay identidad que firmar
 * (anónimo) o si falta el secreto.
 */
export function ximiaIdentityToken(
  id: XimiaIdentity,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string | null {
  if (!id.user_id && !id.email) return null
  const key = secret()
  if (!key) return null
  const exp = nowSeconds + XIMIA_TOKEN_TTL_SECONDS
  const payload = payloadOf(id, exp)
  return `${payload}${SEP}${sign(payload, key)}`
}

/**
 * Verifica y devuelve la identidad, o null. Espejo EXACTO de lo que hace el gate de n8n
 * (`identity_gate`); si cambia uno tiene que cambiar el otro — por eso el formato es
 * deliberadamente trivial de reimplementar.
 */
export function verifyXimiaIdentityToken(
  raw: string | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): XimiaIdentity | null {
  if (!raw) return null
  const key = secret()
  if (!key) return null
  const parts = String(raw).split(SEP)
  if (parts.length !== 4) return null
  const [uid, email, expRaw, hmac] = parts
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= nowSeconds) return null
  if (sign([uid, email, expRaw].join(SEP), key) !== hmac) return null
  if (!uid && !email) return null
  return { user_id: uid || null, email: email || null }
}
