'use server'

/**
 * app/cotizar/actions.ts
 *
 * Cierre del loop: el form (genérico /cotizar o el del catálogo "Quiero esta
 * casa") escribe un lead REAL a Supabase con la atribución de campaña
 * (cookies cf_camp/cf_utm) MÁS el contexto de catálogo si vino (marca,
 * modelo, variante, SC, provincia, precio). Después del insert, despara el
 * email a la marca y al cliente vía Resend; actualiza
 * `leads.notification_status` con el resultado para reintentos asíncronos.
 *
 * El email NO bloquea: si falla, el lead queda igual en DB con
 * status='failed' y el cliente ve la confirmación normal — preferimos lead
 * registrado sin mail a fricción en la UX.
 */

import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAttribution } from '@/lib/track/attribution'
import { sendLeadEmail } from '@/lib/email/lead'
import { emitEngagementEvent } from '@/lib/engagement/emit-event'
import { displayModelTitle } from '@/lib/content/model-naming'
import {
  encodeSessionCookie,
  SESSION_COOKIE_CONFIG,
} from '@/lib/auth/session-cookie'
import { verifyTurnstileToken } from '@/lib/anti-spam/turnstile'
import { checkAndBumpLeadRateLimit } from '@/lib/anti-spam/rate-limit'

export type LeadResult = { ok: boolean; error: string | null }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function optNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export async function submitLead(
  _prev: LeadResult,
  formData: FormData,
): Promise<LeadResult> {
  // Honeypot: campo hidden que un usuario real NUNCA completa. Si viene con
  // valor lo tratamos como bot y devolvemos éxito FAKE — al no darle feedback
  // el bot no puede iterar para adivinar qué falló. NO escribimos a DB, NO
  // mandamos mail, NO seteamos cookies. Ver `hp_website` en LeadForm.tsx.
  if (optText(formData.get('hp_website'))) {
    return { ok: true, error: null }
  }

  // Tipo de lead. Default mantiene compat con el form genérico /cotizar y con
  // "Quiero esta casa" (que no manda el hidden input). 'waitlist_provincia'
  // = usuario interesado en una marca que aún no opera en su provincia.
  const rawLeadType = optText(formData.get('lead_type')) ?? 'quiero_esta_casa'
  const lead_type =
    rawLeadType === 'waitlist_provincia' ? 'waitlist_provincia' : 'quiero_esta_casa'

  const name = String(formData.get('name') ?? '').trim()
  const apellido = optText(formData.get('apellido'))
  const phone = String(formData.get('phone') ?? '').trim()
  const email = optText(formData.get('email'))

  if (!name) {
    return { ok: false, error: 'Necesitamos tu nombre para poder contactarte.' }
  }
  // El email es OBLIGATORIO en todos los flujos: es nuestra clave de identidad
  // canónica (dedup de leads + cf_session). Sin mail no podemos garantizar que
  // un mismo interesado no se registre dos veces, así que es no-negociable.
  if (!email) {
    return { ok: false, error: 'Necesitamos tu email para poder contactarte.' }
  }
  // HTML5 type=email + required acepta "foo@gmail" (sin TLD) y HubSpot lo
  // rechaza al sincronizar. Forzamos local + @ + dominio + . + TLD alfa de 2+.
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { ok: false, error: 'El email no parece válido. Revisalo y volvé a intentar.' }
  }
  // Regla extra por flujo: en "quiero_esta_casa" el teléfono también es
  // obligatorio (cierre rápido por WA/llamada). En "waitlist_provincia" el
  // teléfono es opcional — la promesa es "te avisamos por mail cuando lleguemos".
  if (lead_type === 'quiero_esta_casa' && !phone) {
    return { ok: false, error: 'Tu teléfono es obligatorio para poder contactarte.' }
  }

  // Anti-spam. Orden: honeypot (arriba, silencioso) → Turnstile (verificación
  // CAPTCHA CF, env-gated) → rate-limit por IP+email. Los 3 corren ANTES de
  // cualquier write a DB — spam no toca `users`, `leads` ni Resend.
  const h = await headers()
  const clientIp =
    (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0]?.trim() || null

  const turnstile = await verifyTurnstileToken({
    token: optText(formData.get('cf-turnstile-response')),
    ip: clientIp,
  })
  if (!turnstile.ok) {
    return { ok: false, error: turnstile.error ?? 'Falló la verificación anti-spam.' }
  }

  const rl = await checkAndBumpLeadRateLimit({ ip: clientIp, email })
  if (!rl.allowed) {
    const msg =
      rl.reason === 'email_daily'
        ? 'Ya enviaste varias consultas hoy con este email. Probá de nuevo mañana o escribinos directo.'
        : 'Detectamos muchos intentos desde tu conexión. Esperá unos minutos y probá de nuevo.'
    return { ok: false, error: msg }
  }

  const localidad = optText(formData.get('localidad'))
  const message = optText(formData.get('message'))
  const path = optText(formData.get('path'))

  // Contexto del catálogo — hidden inputs en LeadForm cuando se abre desde
  // "Quiero esta casa". El form genérico /cotizar no los manda → quedan null.
  const marca_id = optText(formData.get('marca_id'))
  const model_slug = optText(formData.get('model_slug'))
  const style_name = optText(formData.get('style_name'))
  const tipologia_code_new = optText(formData.get('tipologia_code_new'))
  const variante = optText(formData.get('variante'))
  const sistema_constructivo = optText(formData.get('sistema_constructivo'))
  const provincia_id = optText(formData.get('provincia_id'))
  // tiene_lote: ahora viene del radio del form (con defaultChecked desde el
  // filtro Casa+Lote si el visitante lo eligió). Solo 'si' / 'no' / null.
  const rawTieneLote = optText(formData.get('tiene_lote'))
  const tiene_lote =
    rawTieneLote === 'si' || rawTieneLote === 'no' ? rawTieneLote : null
  // Campos de calificación nuevos (migración 0071).
  const rawTimeframe = optText(formData.get('timeframe'))
  const timeframe =
    rawTimeframe === '3m' || rawTimeframe === '6m' || rawTimeframe === '1y'
      ? rawTimeframe
      : null
  const rawAhorro = optText(formData.get('ahorro_ars_range'))
  const VALID_AHORRO = ['none', 'lt_10m', '10m_30m', '30m_60m', '60m_plus']
  const ahorro_ars_range =
    rawAhorro && VALID_AHORRO.includes(rawAhorro) ? rawAhorro : null
  const precio_desde_usd = optNumber(formData.get('precio_desde_usd'))
  const cuota_ars = optNumber(formData.get('cuota_ars'))

  const cookieStore = await cookies()
  const { campaign_slug, utm } = resolveAttribution({
    path,
    search: null,
    getCookie: (n) => cookieStore.get(n)?.value,
  })

  const admin = createAdminClient()

  // Identidad canónica: resolvemos (o creamos) el user para colgar el lead de
  // él. Acá hay email (obligatorio) → resuelve por email; el DNI se enganchará
  // en el cálculo financiero y colapsará si hace falta. (phone va como dato, NO
  // como llave: las familias lo comparten.)
  const { data: userId } = await admin.rpc('resolve_user', {
    p_email: email,
    p_phone: phone || null,
    p_name: name,
    p_source: 'catalog',
  })

  // Payload completo para INSERT. Para el ENRICH (lead repetido) derivamos un
  // subconjunto más abajo. user_id va en el payload → cubre insert Y enrich.
  const payload = {
    name,
    apellido,
    phone: phone || null,
    email,
    user_id: userId ?? null,
    localidad,
    message,
    campaign_slug,
    ...utm,
    path,
    marca_id,
    model_slug,
    style_name,
    tipologia_code_new,
    variante,
    sistema_constructivo,
    provincia_id,
    tiene_lote,
    timeframe,
    ahorro_ars_range,
    lead_type,
  }

  // Dedup por email — clave de identidad canónica. Regla de negocio (Andrea):
  // "si alguien, aun en otra sesión, ingresa un mail que tenemos, lo dejamos
  // pasar, no lo volvemos a registrar". Match case-insensitive (ilike sin
  // wildcards) para tolerar mayúsculas distintas; el índice único parcial por
  // lower(email) llega como migración aparte (DDL lo corre Andrea a mano).
  const { data: existing } = await admin
    .from('leads')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  let leadId: string
  if (existing) {
    // ENRICH: pisamos solo con los campos que ESTA visita trajo con valor — así
    // un re-ingreso desde el form genérico /cotizar (sin contexto de catálogo)
    // no borra datos que ya teníamos. Preservamos la atribución del PRIMER
    // contacto (first-touch): campaign_slug, utm_* y path NO se sobrescriben.
    const attributionKeys = new Set([
      'campaign_slug',
      'path',
      ...Object.keys(utm),
    ])
    const enrich: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    for (const [k, v] of Object.entries(payload)) {
      if (attributionKeys.has(k)) continue
      if (v !== null && v !== undefined && v !== '') enrich[k] = v
    }
    const { error: updErr } = await admin
      .from('leads')
      .update(enrich)
      .eq('id', existing.id)
    if (updErr) {
      return {
        ok: false,
        error: `No pudimos registrar tu consulta: ${updErr.message}`,
      }
    }
    leadId = existing.id
  } else {
    const { data: inserted, error } = await admin
      .from('leads')
      .insert(payload)
      .select('id')
      .single()
    if (error) {
      return {
        ok: false,
        error: `No pudimos registrar tu consulta: ${error.message}`,
      }
    }
    leadId = inserted.id
  }

  // ── Email: lookup marca + provincia para armar el payload, despacha en
  //    background (no awaiteamos el send antes de devolver OK al cliente —
  //    el usuario no debería esperar a Resend). Actualizamos el status del
  //    lead después; cualquier reintento de los failed lo hace un worker. ──
  void sendLeadEmailAsync({
    leadId,
    leadType: lead_type,
    name,
    apellido,
    phone,
    email,
    message,
    marca_id,
    model_slug,
    style_name,
    tipologia_code_new,
    variante,
    sistema_constructivo,
    provincia_id,
    precio_desde_usd,
    cuota_ars,
    localidad,
    tiene_lote,
    timeframe,
    ahorro_ars_range,
  })

  // Segmentos B/C/D: avisamos a n8n que entró un lead. n8n hace el JOIN a
  // marcas.plan y decide el segmento (D si marca_id null · B si plan cf_ximia ·
  // C si plan cf) y la secuencia. Best-effort: nunca rompe el registro del lead.
  await emitEngagementEvent({
    event: 'lead_created',
    lead_id: leadId,
    email: email || null,
    source: 'web_form',
    lead_type,
    marca_id: marca_id || null,
    model_slug: model_slug || null,
  })

  // Emitir cookie cf_session — el visitante ya dejó sus datos, no le
  // exigimos OTP para ver el catálogo después. El gate y el LeadForm la
  // respetan: el gate la acepta como prueba de identidad (medio), el
  // LeadForm la lee al montar y muestra success state si matchea email.
  if (email) {
    cookieStore.set({
      name: SESSION_COOKIE_CONFIG.name,
      value: encodeSessionCookie(email),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_COOKIE_CONFIG.maxAgeSeconds,
    })
  }

  return { ok: true, error: null }
}

interface AsyncEmailArgs {
  leadId: string
  leadType: 'quiero_esta_casa' | 'waitlist_provincia'
  name: string
  apellido: string | null
  phone: string
  email: string | null
  message: string | null
  marca_id: string | null
  model_slug: string | null
  style_name: string | null
  tipologia_code_new: string | null
  variante: string | null
  sistema_constructivo: string | null
  provincia_id: string | null
  precio_desde_usd: number | null
  cuota_ars: number | null
  localidad: string | null
  tiene_lote: 'si' | 'no' | null
  timeframe: '3m' | '6m' | '1y' | null
  ahorro_ars_range: string | null
}

async function sendLeadEmailAsync(args: AsyncEmailArgs): Promise<void> {
  const admin = createAdminClient()

  // Lookup marca (para email destino + nombre + línea via primer modelo).
  let marcaName = '—'
  let lineaName: string | null = null
  let marcaEmail: string | null = null
  if (args.marca_id) {
    const { data: marca } = await admin
      .from('marcas')
      .select('name, lead_notification_email')
      .eq('id', args.marca_id)
      .maybeSingle()
    if (marca) {
      marcaName = marca.name ?? '—'
      marcaEmail = marca.lead_notification_email ?? null
    }
  }

  // Lookup nombre de provincia (sólo desde provincia_id; localidad NO se usa
  // como fallback — son campos distintos y se renderizan por separado).
  let provinciaName: string | null = null
  if (args.provincia_id) {
    const { data: p } = await admin
      .from('provincias')
      .select('name')
      .eq('id', args.provincia_id)
      .maybeSingle()
    if (p?.name) provinciaName = p.name
  }

  // Lookup linea + ejes (circulacion + morfologia) desde el primer SKU del
  // modelo. Los ejes viven a nivel de GRUPO (todas las variantes comparten
  // tipología), así que cualquier SKU del mismo (style, tipologia) sirve.
  // Los ejes NO viajan en el formData — se derivan acá para que el mail a
  // la marca use el naming canónico ("CASA EJES CUBO DOMUYO", no "CASA
  // CUBO DOMUYO"). Sin este lookup el H1/subject/fila-Modelo del mail
  // quedaban en el legacy mientras el mensaje del cliente ya venía con el
  // formato nuevo → inconsistencia visible.
  let circulacion: string | null = null
  let morfologia: string | null = null
  if (args.style_name) {
    let q = admin
      .from('house_catalog')
      .select('linea, circulacion, morfologia')
      .ilike('style_name', args.style_name)
    if (args.tipologia_code_new) {
      q = q.eq('tipologia_code_new', args.tipologia_code_new)
    }
    const { data: anySku } = await q.limit(1).maybeSingle()
    if (anySku) {
      lineaName = anySku.linea ?? null
      circulacion = anySku.circulacion ?? null
      morfologia = anySku.morfologia ?? null
    }
  }

  // Nombre canónico del modelo. `displayModelTitle` decide solo entre modo
  // nuevo ("CASA EJES CUBO DOMUYO") y legacy ("CASA CUBO DOMUYO") según
  // qué campos vinieron con valor. Fallback a 'CASA' si no tenemos ni
  // style_name ni tipologia_code_new (waitlist sin modelo, etc).
  const modelDisplayName =
    displayModelTitle({
      style_name: args.style_name,
      tipologia_code_new: args.tipologia_code_new,
      circulacion,
      morfologia,
    }) || 'CASA'

  // Nombre completo para el email (combina name + apellido si vino separado).
  const clientFullName = [args.name, args.apellido].filter(Boolean).join(' ')

  const result = await sendLeadEmail({
    leadType: args.leadType,
    clientName: clientFullName || args.name,
    clientPhone: args.phone,
    clientEmail: args.email,
    clientMessage: args.message,
    marcaName,
    modelDisplayName,
    lineaName,
    variante: args.variante,
    sistemaConstructivo: args.sistema_constructivo,
    precioDesdeUsd: args.precio_desde_usd,
    cuotaArs: args.cuota_ars,
    localidad: args.localidad,
    provinciaName,
    tieneLote: args.tiene_lote,
    timeframe: args.timeframe,
    ahorroArsRange: args.ahorro_ars_range,
    toMarca: marcaEmail,
    toClient: args.email,
  })

  // Persistimos el status del envío para reintentos asíncronos posteriores.
  await admin
    .from('leads')
    .update({ notification_status: result.status })
    .eq('id', args.leadId)
}
