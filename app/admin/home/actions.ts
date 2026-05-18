'use server'

/**
 * app/admin/home/actions.ts
 *
 * Server Actions del admin CF del HomeRow (slider inferior). Espejo de
 * app/admin/header/actions.ts. 5 slots (home-1..home-5), CF b2c/b2b.
 * Identity (slide_key/variant) se fija al crear; el form solo toca
 * contenido (texto + visual). Vacío → NULL → HomeRow usa el default.
 * Writes service-role. Imágenes → bucket `header-images` (reusado).
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  HomeSlideKey,
  HomeVariant,
} from '@/lib/supabase/queries/home_content'

type Result = { error: string | null }

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

function revalidateHome(id?: string) {
  revalidatePath('/admin/home')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/empresas')
  if (id) revalidatePath(`/admin/home/${id}`)
}

export async function createHomeSingleton(
  key: HomeSlideKey,
  variant: HomeVariant,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('home_slide_content').insert({
    marca_id: null,
    variant,
    slide_key: key,
    ...buildPayload(formData),
  })
  if (error && error.code !== '23505') {
    return { error: `Error al crear: ${error.message}` }
  }
  revalidateHome()
  redirect(`/admin/home/${key}?scope=${variant}`)
}

export async function createHomeBanner(
  variant: HomeVariant,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('home_slide_content')
    .insert({
      marca_id: null,
      variant,
      slide_key: 'banner',
      ...buildPayload(formData),
    })
    .select('id')
    .single()
  if (error) return { error: `Error al crear el banner: ${error.message}` }
  revalidateHome()
  redirect(`/admin/home/${inserted.id}?scope=${variant}`)
}

export async function updateHomeSlide(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('home_slide_content')
    .update(buildPayload(formData))
    .eq('id', id)
  if (error) return { error: `Error al actualizar: ${error.message}` }
  revalidateHome(id)
  return { error: null }
}

export async function deleteHomeSlide(
  id: string,
  scope: HomeVariant,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('home_slide_content')
    .delete()
    .eq('id', id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidateHome()
  redirect(`/admin/home?scope=${scope}`)
}

// ── Imagen (bucket header-images reusado) ───────────────────────────────────

const HDR_BUCKET = 'header-images'
const HDR_MAX = 5 * 1024 * 1024
const HDR_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]

export type HomeImageResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

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
  const marker = `/storage/v1/object/public/${HDR_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

export async function uploadHomeImage(
  slideId: string,
  formData: FormData,
): Promise<HomeImageResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!HDR_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. PNG, JPG, WebP, SVG o GIF.' }
  }
  if (file.size > HDR_MAX) {
    return { ok: false, error: 'El archivo supera los 5 MB.' }
  }

  const admin = createAdminClient()
  const { data: row, error: fe } = await admin
    .from('home_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (fe) return { ok: false, error: `Error verificando: ${fe.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const storagePath = `home/${slideId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const buf = await file.arrayBuffer()
  const { error: ue } = await admin.storage
    .from(HDR_BUCKET)
    .upload(storagePath, buf, { contentType: file.type, upsert: false })
  if (ue) return { ok: false, error: `Error al subir: ${ue.message}` }

  const { data: pu } = admin.storage.from(HDR_BUCKET).getPublicUrl(storagePath)
  const imageUrl = pu.publicUrl

  const { error: upe } = await admin
    .from('home_slide_content')
    .update({ image_url: imageUrl })
    .eq('id', slideId)
  if (upe) {
    await admin.storage.from(HDR_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar: ${upe.message}` }
  }

  const prev = pathFromUrl(row.image_url ?? null)
  if (prev && prev !== storagePath) {
    await admin.storage.from(HDR_BUCKET).remove([prev])
  }
  revalidateHome(slideId)
  return { ok: true, imageUrl }
}

export async function removeHomeImage(
  slideId: string,
): Promise<HomeImageResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }
  const admin = createAdminClient()
  const { data: row, error: fe } = await admin
    .from('home_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (fe) return { ok: false, error: `Error verificando: ${fe.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const prev = pathFromUrl(row.image_url ?? null)
  const { error: upe } = await admin
    .from('home_slide_content')
    .update({ image_url: null })
    .eq('id', slideId)
  if (upe) return { ok: false, error: `Error al actualizar: ${upe.message}` }
  if (prev) await admin.storage.from(HDR_BUCKET).remove([prev])
  revalidateHome(slideId)
  return { ok: true, imageUrl: null }
}
