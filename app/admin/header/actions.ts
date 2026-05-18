'use server'

/**
 * app/admin/header/actions.ts
 *
 * Server Actions del admin CF del header (slider HeroRow).
 *
 *   pinned (pasos/principal) → marca_id NULL, variant NULL, is_cf_pinned true.
 *                              Una sola fila, presente en TODAS las versiones.
 *   singleton scoped (crece/flex/lineas-intro) → marca_id NULL, variant=scope.
 *   linea-card → repetible, identidad por id, variant=scope.
 *
 * El identity (slide_kind / variant / is_cf_pinned) se fija al
 * crear/asegurar la fila y NO se edita por form — el form solo toca
 * contenido. Campos de texto vacíos → NULL (así HeroRow cae al hardcoded).
 *
 * Writes con service-role (la tabla solo la escribe CF / portal vía guard).
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  HeaderSlide,
  HeaderSlideKind,
  HeaderVariant,
} from '@/lib/supabase/queries/header_content'
import { HEADER_PINNED_KINDS } from '@/lib/supabase/queries/header_content'
import { sanitizeRichTextOrNull } from '@/lib/sanitize'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseSortOrder(value: FormDataEntryValue | null): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

type ContentPayload = {
  admin_label: string | null
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  long_body: string | null
  bg: string | null
  narrow: boolean
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

function buildContentPayload(formData: FormData): ContentPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  return {
    admin_label: parseOptionalText(formData.get('admin_label')),
    eyebrow: parseOptionalText(formData.get('eyebrow')),
    title: parseOptionalText(formData.get('title')),
    subtitle: parseOptionalText(formData.get('subtitle')),
    body: sanitizeRichTextOrNull(formData.get('body') as string | null),
    cta_label: parseOptionalText(formData.get('cta_label')),
    cta_url: parseOptionalText(formData.get('cta_url')),
    long_body: sanitizeRichTextOrNull(formData.get('long_body') as string | null),
    bg: parseOptionalText(formData.get('bg')),
    narrow: formData.get('narrow') === 'on',
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status)
      ? status
      : 'active',
  }
}

function revalidateHeader(id?: string) {
  revalidatePath('/admin/header')
  revalidatePath('/admin')
  // El header público se renderiza en home, agregador y per-marca.
  revalidatePath('/')
  revalidatePath('/catalogo')
  if (id) revalidatePath(`/admin/header/${id}`)
}

type Result = { error: string | null }

// ---------------------------------------------------------------------------
// createHeaderSingleton — crea la fila de un singleton/pinned y redirige a su
// edición. Form-action (no se crea en render). Igual patrón que /admin/sistemas
// (new → create → redirect a [id]).
// ---------------------------------------------------------------------------

export async function createHeaderSingleton(
  kind: HeaderSlideKind,
  variant: HeaderVariant,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const isPinned = HEADER_PINNED_KINDS.includes(kind)
  const payload = buildContentPayload(formData)

  const { error } = await admin.from('header_slide_content').insert({
    marca_id: null,
    variant: isPinned ? null : variant,
    is_cf_pinned: isPinned,
    slide_kind: kind,
    ...payload,
  })

  // 23505 = ya existe (índice único parcial). No es error: caemos a editar.
  if (error && error.code !== '23505') {
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateHeader()
  redirect(`/admin/header/${kind}?scope=${variant}`)
}

// ---------------------------------------------------------------------------
// updateHeaderSlide — edición de contenido por id (singleton/pinned/linea-card)
// ---------------------------------------------------------------------------

export async function updateHeaderSlide(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const payload = buildContentPayload(formData)

  const { error } = await admin
    .from('header_slide_content')
    .update(payload)
    .eq('id', id)

  if (error) return { error: `Error al actualizar: ${error.message}` }

  revalidateHeader(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// createHeaderLineaCard — nueva card de línea (repetible) para un scope
// ---------------------------------------------------------------------------

export async function createHeaderLineaCard(
  variant: HeaderVariant,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const payload = buildContentPayload(formData)

  const { data: inserted, error } = await admin
    .from('header_slide_content')
    .insert({
      marca_id: null,
      variant,
      is_cf_pinned: false,
      slide_kind: 'linea-card',
      ...payload,
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la card: ${error.message}` }

  revalidateHeader()
  redirect(`/admin/header/${inserted.id}?scope=${variant}`)
}

// ---------------------------------------------------------------------------
// createHeaderBanner — slide 'banner' repetible (promos/contenido extra)
// ---------------------------------------------------------------------------

export async function createHeaderBanner(
  variant: HeaderVariant,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('header_slide_content')
    .insert({
      marca_id: null,
      variant,
      is_cf_pinned: false,
      slide_kind: 'banner',
      ...buildContentPayload(formData),
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear el banner: ${error.message}` }

  revalidateHeader()
  redirect(`/admin/header/${inserted.id}?scope=${variant}`)
}

// ---------------------------------------------------------------------------
// deleteHeaderSlide — borrar una fila → HeroRow cae al hardcoded de ese slide
// ---------------------------------------------------------------------------

export async function deleteHeaderSlide(
  id: string,
  scope: HeaderVariant,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('header_slide_content')
    .delete()
    .eq('id', id)

  if (error) return { error: `No se pudo eliminar: ${error.message}` }

  revalidateHeader()
  redirect(`/admin/header?scope=${scope}`)
}

// ---------------------------------------------------------------------------
// seedB2BFromB2C — copia idempotente de la versión B2C a la B2B.
// Pinned NO se copian (son compartidos). Singletons: solo si falta en B2B.
// linea-card: solo si B2B no tiene ninguna (evita duplicar al re-correr).
// ---------------------------------------------------------------------------

export async function seedB2BFromB2C(): Promise<Result> {
  const admin = createAdminClient()

  const { data: b2cRows, error: e1 } = await admin
    .from('header_slide_content')
    .select('*')
    .is('marca_id', null)
    .eq('variant', 'b2c')
    .eq('is_cf_pinned', false)
  if (e1) return { error: `Error leyendo B2C: ${e1.message}` }

  const { data: b2bRows, error: e2 } = await admin
    .from('header_slide_content')
    .select('slide_kind')
    .is('marca_id', null)
    .eq('variant', 'b2b')
    .eq('is_cf_pinned', false)
  if (e2) return { error: `Error leyendo B2B: ${e2.message}` }

  const b2bKinds = new Set((b2bRows ?? []).map((r) => r.slide_kind))
  const b2bHasLineaCards = b2bKinds.has('linea-card')

  const toInsert = (b2cRows ?? [])
    .filter((r: HeaderSlide) =>
      r.slide_kind === 'linea-card'
        ? !b2bHasLineaCards
        : !b2bKinds.has(r.slide_kind),
    )
    .map((r: HeaderSlide) => ({
      marca_id: null,
      variant: 'b2b',
      is_cf_pinned: false,
      slide_kind: r.slide_kind,
      eyebrow: r.eyebrow,
      title: r.title,
      subtitle: r.subtitle,
      body: r.body,
      cta_label: r.cta_label,
      cta_url: r.cta_url,
      image_url: r.image_url,
      long_body: r.long_body,
      gallery_urls: r.gallery_urls,
      sort_order: r.sort_order,
      status: r.status,
    }))

  if (toInsert.length === 0) {
    return { error: 'Nada para sembrar: B2B ya tiene esos slides.' }
  }

  const { error: e3 } = await admin
    .from('header_slide_content')
    .insert(toInsert)
  if (e3) return { error: `Error sembrando B2B: ${e3.message}` }

  revalidateHeader()
  return { error: null }
}

// ---------------------------------------------------------------------------
// uploadHeaderImage / removeHeaderImage — foto principal del slide.
// Bucket `header-images`. Mismo patrón que uploadScImage.
// ---------------------------------------------------------------------------

const HDR_BUCKET = 'header-images'
const HDR_MAX_BYTES = 5 * 1024 * 1024
const HDR_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]

export type HeaderImageActionResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

function sanitizeFilename(name: string): string {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    normalized
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'header'
  )
}

function hdrStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${HDR_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function uploadHeaderImage(
  slideId: string,
  formData: FormData,
): Promise<HeaderImageActionResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!HDR_ALLOWED_MIME.includes(file.type)) {
    return {
      ok: false,
      error: 'Formato no permitido. Usá PNG, JPG, WebP, SVG o GIF.',
    }
  }
  if (file.size > HDR_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 5 MB.' }
  }

  const admin = createAdminClient()

  const { data: row, error: fetchErr } = await admin
    .from('header_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()

  if (fetchErr)
    return { ok: false, error: `Error verificando el slide: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const safeName = sanitizeFilename(file.name)
  const storagePath = `${slideId}/${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(HDR_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage
    .from(HDR_BUCKET)
    .getPublicUrl(storagePath)
  const imageUrl = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ image_url: imageUrl })
    .eq('id', slideId)

  if (updateErr) {
    await admin.storage.from(HDR_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar el slide: ${updateErr.message}` }
  }

  const previousPath = hdrStoragePathFromUrl(row.image_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateHeader(slideId)
  return { ok: true, imageUrl }
}

export async function removeHeaderImage(
  slideId: string,
): Promise<HeaderImageActionResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }

  const admin = createAdminClient()

  const { data: row, error: fetchErr } = await admin
    .from('header_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()

  if (fetchErr)
    return { ok: false, error: `Error verificando el slide: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const previousPath = hdrStoragePathFromUrl(row.image_url ?? null)

  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ image_url: null })
    .eq('id', slideId)

  if (updateErr) {
    return { ok: false, error: `Error al actualizar el slide: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateHeader(slideId)
  return { ok: true, imageUrl: null }
}

// ---------------------------------------------------------------------------
// Iso de la columna de color (crece/flex) → panel_image_url. Mismo bucket.
// ---------------------------------------------------------------------------

export async function uploadHeaderPanelImage(
  slideId: string,
  formData: FormData,
): Promise<HeaderImageActionResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!HDR_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. PNG, JPG, WebP, SVG o GIF.' }
  }
  if (file.size > HDR_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 5 MB.' }
  }

  const admin = createAdminClient()
  const { data: row, error: fetchErr } = await admin
    .from('header_slide_content')
    .select('id, panel_image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (fetchErr)
    return { ok: false, error: `Error verificando el slide: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const storagePath = `panel/${slideId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(HDR_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })
  if (uploadErr)
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }

  const { data: pu } = admin.storage.from(HDR_BUCKET).getPublicUrl(storagePath)
  const imageUrl = pu.publicUrl

  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ panel_image_url: imageUrl })
    .eq('id', slideId)
  if (updateErr) {
    await admin.storage.from(HDR_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar el slide: ${updateErr.message}` }
  }

  const previousPath = hdrStoragePathFromUrl(row.panel_image_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }
  revalidateHeader(slideId)
  return { ok: true, imageUrl }
}

export async function removeHeaderPanelImage(
  slideId: string,
): Promise<HeaderImageActionResult> {
  if (!slideId) return { ok: false, error: 'Falta el ID del slide.' }
  const admin = createAdminClient()
  const { data: row, error: fetchErr } = await admin
    .from('header_slide_content')
    .select('id, panel_image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (fetchErr)
    return { ok: false, error: `Error verificando el slide: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const previousPath = hdrStoragePathFromUrl(row.panel_image_url ?? null)
  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ panel_image_url: null })
    .eq('id', slideId)
  if (updateErr)
    return { ok: false, error: `Error al actualizar el slide: ${updateErr.message}` }
  if (previousPath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }
  revalidateHeader(slideId)
  return { ok: true, imageUrl: null }
}
