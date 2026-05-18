'use server'

/**
 * app/portal/header/actions.ts
 *
 * Self-service del header para la MARCA logueada.
 *
 * SEGURIDAD POR CONSTRUCCIÓN: la marca se deriva SIEMPRE de la sesión
 * (getMyMarca(user.id)) — nunca llega por el cliente. Toda escritura se
 * fuerza a `marca_id = miMarca.id`; las ops por id verifican que la fila
 * sea de esa marca y NO sea pinned (los pinned los administra solo CF).
 *
 * El identity (marca_id / slide_kind / variant=null / is_cf_pinned=false)
 * lo fija la action; el form solo toca contenido. Vacío → NULL.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import type { HeaderSlideKind } from '@/lib/supabase/queries/header_content'
import { sanitizeRichTextOrNull } from '@/lib/sanitize'

type Result = { error: string | null }

export type MyHeaderImageResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

/** Kinds que la marca puede editar (pasos/principal son CF-pinned). */
const MARCA_EDITABLE_KINDS: HeaderSlideKind[] = [
  'crece',
  'flex',
  'lineas-intro',
]

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

function buildContentPayload(formData: FormData) {
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

/** Marca del usuario logueado (de la sesión). null si no hay. */
async function callerMarcaId(): Promise<string | null> {
  const server = await createClient()
  const {
    data: { user },
  } = await server.auth.getUser()
  if (!user) return null
  const marca = await getMyMarca(server, user.id)
  return marca?.id ?? null
}

/** Verifica que la fila `id` sea de la marca y editable (no pinned). */
async function assertOwnEditable(
  marcaId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('header_slide_content')
    .select('id, marca_id, is_cf_pinned')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }
  if (row.is_cf_pinned)
    return { ok: false, error: 'Ese slide lo administra ConstruirFácil.' }
  if (row.marca_id !== marcaId)
    return { ok: false, error: 'Ese slide no es de tu marca.' }
  return { ok: true }
}

function revalidateMine() {
  revalidatePath('/portal/header')
  // El catálogo de la marca es dinámico (se re-fetchea), no requiere revalidate.
}

// ---------------------------------------------------------------------------
// Singletons propios (crece / flex / lineas-intro)
// ---------------------------------------------------------------------------

export async function createMyHeaderSingleton(
  kind: HeaderSlideKind,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  if (!MARCA_EDITABLE_KINDS.includes(kind))
    return { error: 'Ese slide no es editable por la marca.' }

  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const admin = createAdminClient()
  const { error } = await admin.from('header_slide_content').insert({
    marca_id: marcaId,
    variant: null,
    is_cf_pinned: false,
    slide_kind: kind,
    ...buildContentPayload(formData),
  })

  if (error && error.code !== '23505') {
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateMine()
  redirect(`/portal/header/${kind}`)
}

// ---------------------------------------------------------------------------
// Edición por id (singleton/card de la marca)
// ---------------------------------------------------------------------------

export async function updateMyHeaderSlide(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const guard = await assertOwnEditable(marcaId, id)
  if (!guard.ok) return { error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('header_slide_content')
    .update(buildContentPayload(formData))
    .eq('id', id)

  if (error) return { error: `Error al actualizar: ${error.message}` }

  revalidateMine()
  return { error: null }
}

// ---------------------------------------------------------------------------
// Card de línea propia (repetible)
// ---------------------------------------------------------------------------

export async function createMyLineaCard(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('header_slide_content')
    .insert({
      marca_id: marcaId,
      variant: null,
      is_cf_pinned: false,
      slide_kind: 'linea-card',
      ...buildContentPayload(formData),
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear la card: ${error.message}` }

  revalidateMine()
  redirect(`/portal/header/${inserted.id}`)
}

// ── Banner repetible de la marca ────────────────────────────────────────────

export async function createMyHeaderBanner(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('header_slide_content')
    .insert({
      marca_id: marcaId,
      variant: null,
      is_cf_pinned: false,
      slide_kind: 'banner',
      ...buildContentPayload(formData),
    })
    .select('id')
    .single()

  if (error) return { error: `Error al crear el banner: ${error.message}` }

  revalidateMine()
  redirect(`/portal/header/${inserted.id}`)
}

export async function deleteMyHeaderSlide(id: string): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const guard = await assertOwnEditable(marcaId, id)
  if (!guard.ok) return { error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('header_slide_content')
    .delete()
    .eq('id', id)

  if (error) return { error: `No se pudo eliminar: ${error.message}` }

  revalidateMine()
  redirect('/portal/header')
}

// ---------------------------------------------------------------------------
// Foto del slide — bucket header-images, con guard de propiedad.
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

export async function uploadMyHeaderImage(
  slideId: string,
  formData: FormData,
): Promise<MyHeaderImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwnEditable(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

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
  const { data: row } = await admin
    .from('header_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
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
    return { ok: false, error: `Error al subir: ${uploadErr.message}` }
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
    return { ok: false, error: `Error al actualizar: ${updateErr.message}` }
  }

  const previousPath = hdrStoragePathFromUrl(row.image_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateMine()
  return { ok: true, imageUrl }
}

export async function removeMyHeaderImage(
  slideId: string,
): Promise<MyHeaderImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwnEditable(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('header_slide_content')
    .select('id, image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const previousPath = hdrStoragePathFromUrl(row.image_url ?? null)

  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ image_url: null })
    .eq('id', slideId)
  if (updateErr) {
    return { ok: false, error: `Error al actualizar: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateMine()
  return { ok: true, imageUrl: null }
}

// ── Iso de la columna de color (crece/flex) → panel_image_url ───────────────

export async function uploadMyHeaderPanelImage(
  slideId: string,
  formData: FormData,
): Promise<MyHeaderImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwnEditable(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

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
  const { data: row } = await admin
    .from('header_slide_content')
    .select('id, panel_image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const storagePath = `panel/${slideId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(HDR_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })
  if (uploadErr) {
    return { ok: false, error: `Error al subir: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage
    .from(HDR_BUCKET)
    .getPublicUrl(storagePath)
  const imageUrl = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ panel_image_url: imageUrl })
    .eq('id', slideId)
  if (updateErr) {
    await admin.storage.from(HDR_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar: ${updateErr.message}` }
  }

  const previousPath = hdrStoragePathFromUrl(row.panel_image_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateMine()
  return { ok: true, imageUrl }
}

export async function removeMyHeaderPanelImage(
  slideId: string,
): Promise<MyHeaderImageResult> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { ok: false, error: 'No se encontró tu marca.' }
  const guard = await assertOwnEditable(marcaId, slideId)
  if (!guard.ok) return { ok: false, error: guard.error }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('header_slide_content')
    .select('id, panel_image_url')
    .eq('id', slideId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'El slide no existe.' }

  const previousPath = hdrStoragePathFromUrl(row.panel_image_url ?? null)
  const { error: updateErr } = await admin
    .from('header_slide_content')
    .update({ panel_image_url: null })
    .eq('id', slideId)
  if (updateErr) {
    return { ok: false, error: `Error al actualizar: ${updateErr.message}` }
  }
  if (previousPath) {
    await admin.storage.from(HDR_BUCKET).remove([previousPath])
  }

  revalidateMine()
  return { ok: true, imageUrl: null }
}
