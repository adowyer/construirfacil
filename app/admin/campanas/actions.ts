'use server'

/**
 * app/admin/campanas/actions.ts
 *
 * Server Actions del admin de campañas. Espejo de app/admin/home/actions.ts.
 * Writes service-role (createAdminClient, bypassa RLS). El `slug` es la llave
 * canónica (path = utm_content): se slugifica siempre; si está vacío se deriva
 * de la localidad. Revalida la landing de esa campaña.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugifyLocalidad } from '@/lib/supabase/queries/campaigns'

type Result = { error: string | null }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** datetime-local ("2026-05-20T09:00") o null. */
function optStamp(v: FormDataEntryValue | null): string | null {
  const s = optText(v)
  return s
}

function buildPayload(formData: FormData) {
  const localidad = optText(formData.get('localidad')) ?? ''
  const rawSlug = optText(formData.get('slug'))
  const slug = slugifyLocalidad(rawSlug || localidad)
  // `short_slug` opcional: si lo dejan vacío, queda null (no se publica URL
  // corta). Si lo escriben, lo slugificamos para evitar caracteres raros en
  // un alias que va a ir impreso.
  const rawShortSlug = optText(formData.get('short_slug'))
  const short_slug = rawShortSlug ? slugifyLocalidad(rawShortSlug) || null : null
  return {
    slug,
    short_slug,
    localidad,
    provincia: optText(formData.get('provincia')),
    eyebrow: optText(formData.get('eyebrow')),
    headline: optText(formData.get('headline')) ?? '',
    subheadline: optText(formData.get('subheadline')),
    cta_label: optText(formData.get('cta_label')),
    image_url: optText(formData.get('image_url')),
    price_from: optText(formData.get('price_from')),
    active: formData.get('active') === 'on',
    start_at: optStamp(formData.get('start_at')),
    end_at: optStamp(formData.get('end_at')),
  }
}

function revalidateCampaign(
  slug?: string | null,
  id?: string,
  shortSlug?: string | null,
) {
  revalidatePath('/admin/campanas')
  revalidatePath('/admin')
  revalidatePath('/')
  if (slug) revalidatePath(`/casa-financiada/${slug}`)
  if (shortSlug) revalidatePath(`/${shortSlug}`)
  if (id) revalidatePath(`/admin/campanas/${id}`)
}

export async function createCampaign(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const payload = buildPayload(formData)
  if (!payload.localidad || !payload.headline) {
    return { error: 'Localidad y título son obligatorios.' }
  }
  if (!payload.slug) {
    return { error: 'No se pudo derivar el slug de la localidad.' }
  }
  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('campaigns')
    .insert(payload)
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una campaña con el slug "${payload.slug}".` }
    }
    return { error: `Error al crear: ${error.message}` }
  }
  revalidateCampaign(payload.slug, undefined, payload.short_slug)
  redirect(`/admin/campanas/${inserted.id}`)
}

export async function updateCampaign(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const payload = buildPayload(formData)
  if (!payload.localidad || !payload.headline) {
    return { error: 'Localidad y título son obligatorios.' }
  }
  if (!payload.slug) {
    return { error: 'No se pudo derivar el slug de la localidad.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('campaigns')
    .update(payload)
    .eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una campaña con el slug "${payload.slug}".` }
    }
    return { error: `Error al actualizar: ${error.message}` }
  }
  revalidateCampaign(payload.slug, id, payload.short_slug)
  return { error: null }
}

export async function deleteCampaign(
  id: string,
  slug: string,
  shortSlug?: string | null,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('campaigns').delete().eq('id', id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidateCampaign(slug, undefined, shortSlug)
  redirect('/admin/campanas')
}
