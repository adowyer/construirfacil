/**
 * app/api/whatsapp/webhook/route.ts
 *
 * Webhook de WhatsApp Cloud API.
 *
 *   GET  → handshake de verificación de Meta (hub.challenge).
 *   POST → estados de entrega (sent/delivered/read/failed) + mensajes entrantes.
 *
 * POR QUÉ ACÁ Y NO EN n8n
 * WhatsApp dispara un evento por mensaje POR CADA cambio de estado. Una tanda de 321
 * leads son >1.000 eventos en pocas horas. n8n se paga por ejecución (ver CLAUDE.md:
 * el sync que corría cada minuto se comió el crédito entero). Vercel no.
 *
 * QUÉ RESUELVE
 * Meta devuelve 200 cuando ACEPTA un mensaje, no cuando lo ENTREGA. Sin este ledger,
 * una tanda "sale bien" y nadie sabe cuántos llegaron. El éxito del transporte no es
 * el éxito del hecho.
 *
 * GARANTÍAS (en código, no en el prompt de nadie):
 *   - Firma OBLIGATORIA (X-Hub-Signature-256). Sin `WHATSAPP_APP_SECRET` la ruta
 *     RECHAZA todo: aceptar webhooks sin firmar dejaría que cualquiera falsifique una
 *     baja o un "entregado". Falla cerrada, a propósito.
 *   - Idempotente: Meta reintenta. `dedupe_key` + upsert ignorando duplicados.
 *   - Siempre 200 ante payload raro (si devolvés error, Meta reintenta y termina
 *     desactivando el webhook). Los errores se loguean, no se propagan.
 *   - BAJA solo con candidato ÚNICO. Ante empate NO se da de baja a nadie: dar de
 *     baja a la persona equivocada la deja sin su información de crédito.
 *
 * Env: WHATSAPP_APP_SECRET · WHATSAPP_WEBHOOK_VERIFY_TOKEN
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { digits, phoneKey } from '@/lib/whatsapp/phone'

/** Palabra de baja. El footer de la plantilla la promete: acá se cumple. */
const OPT_OUT = /^\s*(baja|stop|cancelar)\b/i

type EventRow = {
  kind: 'status' | 'inbound'
  wamid: string | null
  wa_phone: string
  phone_key: string
  lead_id: string | null
  status: string | null
  error_code: number | null
  error_title: string | null
  body: string | null
  occurred_at: string
  raw: unknown
  dedupe_key: string
}

/* ────────────────────────── GET: handshake ────────────────────────── */

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (!expected) {
    console.error('[wa-webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN no configurado')
    return new NextResponse('not configured', { status: 500 })
  }
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === expected) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

/* ────────────────────────── firma ────────────────────────── */

function signatureOk(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false

  const mine = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  const theirs = Buffer.from(header.slice('sha256='.length), 'hex')
  // Longitudes distintas → timingSafeEqual tira. Chequear antes.
  return mine.length === theirs.length && timingSafeEqual(mine, theirs)
}

/* ────────────────────────── POST: eventos ────────────────────────── */

export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (!signatureOk(raw, request.headers.get('x-hub-signature-256'))) {
    console.error('[wa-webhook] firma inválida o WHATSAPP_APP_SECRET sin configurar')
    return new NextResponse('invalid signature', { status: 401 })
  }

  try {
    await handle(JSON.parse(raw))
  } catch (err) {
    // Nunca propagamos: un 5xx hace que Meta reintente y termine desactivando el
    // webhook. Preferimos perder un evento antes que perder el canal entero.
    console.error('[wa-webhook] error procesando payload:', err)
  }
  return new NextResponse('ok', { status: 200 })
}

async function handle(payload: any): Promise<void> {
  const rows: EventRow[] = []
  const inbound: { phone_key: string; body: string }[] = []

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {}

      for (const s of v.statuses ?? []) {
        const phone = digits(s.recipient_id)
        const key = phoneKey(phone)
        if (!key) continue
        const err = s.errors?.[0]
        rows.push({
          kind: 'status',
          wamid: s.id ?? null,
          wa_phone: phone,
          phone_key: key,
          lead_id: null,
          status: s.status ?? null,
          error_code: err?.code ?? null,
          error_title: err?.title ?? null,
          body: null,
          occurred_at: tsToIso(s.timestamp),
          raw: s,
          dedupe_key: `${s.id ?? 'nowamid'}:status:${s.status ?? ''}`,
        })
      }

      for (const m of v.messages ?? []) {
        const phone = digits(m.from)
        const key = phoneKey(phone)
        if (!key) continue
        const text: string | null = m.text?.body ?? m.button?.text ?? null
        rows.push({
          kind: 'inbound',
          wamid: m.id ?? null,
          wa_phone: phone,
          phone_key: key,
          lead_id: null,
          status: null,
          error_code: null,
          error_title: null,
          body: text,
          occurred_at: tsToIso(m.timestamp),
          raw: m,
          dedupe_key: `${m.id ?? 'nowamid'}:inbound:`,
        })
        if (text && OPT_OUT.test(text)) inbound.push({ phone_key: key, body: text })
      }
    }
  }

  if (!rows.length) return

  const admin = createAdminClient()

  // Resolver lead_id best-effort. Solo candidato ÚNICO: si dos leads comparten los
  // últimos 8 dígitos, dejamos lead_id en null y el evento igual queda registrado.
  const keys = [...new Set(rows.map((r) => r.phone_key))]
  const { data: leads } = await admin
    .from('leads')
    .select('id, phone, unsubscribed')
    .not('phone', 'is', null)

  const byKey = new Map<string, { id: string; unsubscribed: boolean | null }[]>()
  for (const l of (leads ?? []) as { id: string; phone: string; unsubscribed: boolean | null }[]) {
    const k = phoneKey(l.phone)
    if (!k || !keys.includes(k)) continue
    const list = byKey.get(k) ?? []
    list.push({ id: l.id, unsubscribed: l.unsubscribed })
    byKey.set(k, list)
  }
  for (const r of rows) {
    const hits = byKey.get(r.phone_key)
    if (hits?.length === 1) r.lead_id = hits[0].id
  }

  const { error } = await admin
    .from('whatsapp_events')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (error) console.error('[wa-webhook] no se pudo escribir el ledger:', error.message)

  // BAJA: el footer de la plantilla la promete, así que tiene que funcionar de verdad.
  for (const { phone_key: k, body } of inbound) {
    const hits = byKey.get(k)
    if (hits?.length !== 1) {
      console.error(
        `[wa-webhook] BAJA sin candidato único (${hits?.length ?? 0} leads con phone_key ${k}) — no se da de baja a nadie`,
      )
      continue
    }
    if (hits[0].unsubscribed) continue
    const { error: e } = await admin
      .from('leads')
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq('id', hits[0].id)
    if (e) console.error('[wa-webhook] no se pudo dar la baja:', e.message)
    else console.log(`[wa-webhook] baja aplicada a lead ${hits[0].id} ("${body.slice(0, 20)}")`)
  }
}

/** Meta manda epoch en SEGUNDOS, como string. */
function tsToIso(ts: unknown): string {
  const n = Number(ts)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString()
}
