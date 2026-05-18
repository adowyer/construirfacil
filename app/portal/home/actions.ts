'use server'

/**
 * app/portal/home/actions.ts
 *
 * Self-service del HomeRow para la MARCA logueada. Marca de la SESIÓN
 * (getMyMarca), nunca del cliente. Writes forzadas a marca_id de esa marca;
 * ops por id verifican propiedad. Imágenes → bucket `header-images`.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import type { HomeSlideKey } from '@/lib/supabase/queries/home_content'

type Result = { error: string | null }

export type MyHomeImageResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function sortOrder(v: FormDataEntryValue | null): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}
function buildPayload(formData: FormData) {
  const status = (optText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  const ctaStyle = optText(formData.get('cta_style'))
  return {
    admin_label: optText(formData.get('admin_label')),
    eyebrow: optText(formData.get('eyebrow')),
    label: optText(formData.get('label')),
    body: optText(formData.get('body')),
    cta_label: optText(formData.get('cta_label')),
    cta_url: optText(formData.get('cta_url')),
    cta_style:
      ctaStyle && ['primary', 'ghost', 'none'].includes(ctaStyle)
        ? ctaStyle
        : null,
    bg: optText(formData.get('bg')),
    text_color: optText(formData.get('text_color')),
    body_color: optText(formData.get('body_color')),
    narrow: formData.get('narrow') === 'on',
    sort_order: sortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status)
      ? status
      : 'active',
  }
}

async function callerMarcaId(): Promise<string | null> {
  const server = await createClient()
  const {
    data: { user },
  } = await server.auth.getUser()
  if (!user) return null
  const marca = await getMyMarca(server, user.id)
  return marca?.id ?? null
}

async function assertOwn(
  marcaId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('home_slide_content')
    .select('id, marca_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }
  if (row.marca_id !== marcaId)
    return { ok: false, error: 'Ese slide no es de tu marca.' }
  return { ok: true }
}

function revalidateMine() {
  revalidatePath('/portal/home')
}

export async function createMyHomeSingleton(
  key: HomeSlideKey,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }
  const admin = createAdminClient()
  const { error } = await admin.from('home_slide_content').insert({
    marca_id: marcaId,
    variant: null,
    slide_key: key,
    ...buildPayload(formData),
  })
  if (error && error.code !== '23505') {
    return { error: `Error al crear: ${error.message}` }
  }
  revalidateMine()
  redirect(`/portal/home/${key}`)
}

export async function updateMyHomeSlide(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }
  const guard = await assertOwn(marcaId, id)
  if (!guard.ok) return { error: guard.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('home_slide_content')
    .update(buildPayload(formData))
    .eq('id', id)
  if (error) return { error: `Error al actualizar: ${error.message}` }
  revalidateMine()
  return { error: null }
}

export async function deleteMyHomeSlide(id: string): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }
  const guard = await assertOwn(marcaId, id)
  if (!guard.ok) return { error: guard.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('home_slide_content')
    .delete()
    .eq('id', id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidateMine()
  redirect('/portal/home')
}

// ── Imagen (bucket header-images) ───────────────────────────────────────────

const BKT = 'header-images'
const MAX = 5 * 1024 * 1024
const MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']

function sanitizeFilename(name: string): string {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    n
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'home'
  )
}
function pathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BKT}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

export async function uploadMyHomeImage(
  slideId: string,
  formData: FormData,
): Promise<MyHomeImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwn(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. PNG, JPG, WebP, SVG o GIF.' }
  }
  if (file.size > MAX) return { ok: false, error: 'El archivo supera los 5 MB.' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('home_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const storagePath = `home/${slideId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const buf = await file.arrayBuffer()
  const { error: ue } = await admin.storage
    .from(BKT)
    .upload(storagePath, buf, { contentType: file.type, upsert: false })
  if (ue) return { ok: false, error: `Error al subir: ${ue.message}` }

  const { data: pu } = admin.storage.from(BKT).getPublicUrl(storagePath)
  const imageUrl = pu.publicUrl
  const { error: upe } = await admin
    .from('home_slide_content')
    .update({ image_url: imageUrl })
    .eq('id', slideId)
  if (upe) {
    await admin.storage.from(BKT).remove([storagePath])
    return { ok: false, error: `Error al actualizar: ${upe.message}` }
  }
  const prev = pathFromUrl(row.image_url ?? null)
  if (prev && prev !== storagePath) await admin.storage.from(BKT).remove([prev])
  revalidateMine()
  return { ok: true, imageUrl }
}

export async function removeMyHomeImage(
  slideId: string,
): Promise<MyHomeImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwn(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('home_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }
  const prev = pathFromUrl(row.image_url ?? null)
  const { error: upe } = await admin
    .from('home_slide_content')
    .update({ image_url: null })
    .eq('id', slideId)
  if (upe) return { ok: false, error: `Error al actualizar: ${upe.message}` }
  if (prev) await admin.storage.from(BKT).remove([prev])
  revalidateMine()
  return { ok: true, imageUrl: null }
}
