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

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAttribution } from '@/lib/track/attribution'
import { sendLeadEmail } from '@/lib/email/lead'

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
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  if (!name || !phone) {
    return { ok: false, error: 'Tu nombre y teléfono son obligatorios.' }
  }

  const email = optText(formData.get('email'))
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
  const precio_desde_usd = optNumber(formData.get('precio_desde_usd'))
  const cuota_ars = optNumber(formData.get('cuota_ars'))

  const cookieStore = await cookies()
  const { campaign_slug, utm } = resolveAttribution({
    path,
    search: null,
    getCookie: (n) => cookieStore.get(n)?.value,
  })

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('leads')
    .insert({
      name,
      phone,
      email,
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
    })
    .select('id')
    .single()
  if (error) {
    return {
      ok: false,
      error: `No pudimos registrar tu consulta: ${error.message}`,
    }
  }

  // ── Email: lookup marca + provincia para armar el payload, despacha en
  //    background (no awaiteamos el send antes de devolver OK al cliente —
  //    el usuario no debería esperar a Resend). Actualizamos el status del
  //    lead después; cualquier reintento de los failed lo hace un worker. ──
  void sendLeadEmailAsync({
    leadId: inserted.id,
    name,
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
  })

  return { ok: true, error: null }
}

interface AsyncEmailArgs {
  leadId: string
  name: string
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

  // Lookup nombre de provincia.
  let provinciaName: string | null = args.localidad
  if (args.provincia_id) {
    const { data: p } = await admin
      .from('provincias')
      .select('name')
      .eq('id', args.provincia_id)
      .maybeSingle()
    if (p?.name) provinciaName = p.name
  }

  // Lookup linea desde el primer SKU del modelo (model_slug).
  if (args.model_slug && args.style_name) {
    const { data: anySku } = await admin
      .from('house_catalog')
      .select('linea')
      .ilike('style_name', args.style_name)
      .limit(1)
      .maybeSingle()
    if (anySku?.linea) lineaName = anySku.linea
  }

  // Composé "modelDisplayName" — preferimos el split CASA NODO ALECRIN si
  // tenemos los datos; si no, fallback al style_name a secas.
  const heroBits = [
    args.tipologia_code_new ? `CASA ${args.tipologia_code_new}` : 'CASA',
    args.style_name?.toUpperCase() ?? '',
  ].filter(Boolean)
  const modelDisplayName = heroBits.join(' ')

  const result = await sendLeadEmail({
    clientName: args.name,
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
    provinciaName,
    toMarca: marcaEmail,
    toClient: args.email,
  })

  // Persistimos el status del envío para reintentos asíncronos posteriores.
  await admin
    .from('leads')
    .update({ notification_status: result.status })
    .eq('id', args.leadId)
}
