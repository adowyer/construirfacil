'use server'

/**
 * app/cotizar/actions.ts
 *
 * Cierre del loop: el form de /cotizar escribe un lead REAL a Supabase
 * (service-role) con la atribución de campaña resuelta server-side desde
 * las cookies (cf_camp/cf_utm) — la MISMA lógica que el beacon, así el
 * lead y sus eventos atribuyen igual y el CPL por banner cierra.
 */

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAttribution } from '@/lib/track/attribution'

export type LeadResult = { ok: boolean; error: string | null }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
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

  const cookieStore = await cookies()
  const { campaign_slug, utm } = resolveAttribution({
    path,
    search: null,
    getCookie: (n) => cookieStore.get(n)?.value,
  })

  const admin = createAdminClient()
  const { error } = await admin.from('leads').insert({
    name,
    phone,
    email,
    localidad,
    message,
    campaign_slug,
    ...utm,
    path,
  })
  if (error) {
    return {
      ok: false,
      error: `No pudimos registrar tu consulta: ${error.message}`,
    }
  }
  return { ok: true, error: null }
}
