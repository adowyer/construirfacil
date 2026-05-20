'use server'

/**
 * app/admin/sistemas/actions.ts
 *
 * Server Actions para la librería de sistemas constructivos.
 *
 *   Ámbito Global (marca_id NULL) → compartido por todas las marcas.
 *   Ámbito Marca  (marca_id = X)   → propietario de esa marca.
 *
 * `slug` se deriva del nombre al crear y NO se edita después (el catálogo
 * matchea house_catalog.sistema_constructivo contra él). `marca_id` tampoco
 * se edita (identifica la fila junto al slug). El form los muestra disabled.
 *
 * Todas las escrituras usan service-role (bypass RLS).
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { sanitizeRichTextOrNull } from '@/lib/sanitize'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseRequiredText(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim()
}

function parseSortOrder(value: FormDataEntryValue | null): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** '' / 'global' / null → null (compartido); cualquier otro → ese marca_id. */
function parseMarcaId(value: FormDataEntryValue | null): string | null {
  const s = parseOptionalText(value)
  if (!s || s === 'global') return null
  return s
}

type ScPayload = {
  marca_id: string | null
  slug: string
  name: string
  tagline: string | null
  body: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(
  formData: FormData,
  opts: { lockSlug?: string; lockMarca?: string | null },
): ScPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  const name = parseRequiredText(formData.get('name'))
  return {
    marca_id:
      opts.lockMarca !== undefined
        ? opts.lockMarca
        : parseMarcaId(formData.get('marca_id')),
    slug: opts.lockSlug ?? slugify(name),
    name,
    tagline: parseOptionalText(formData.get('tagline')),
    body: sanitizeRichTextOrNull(parseOptionalText(formData.get('body'))),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
  }
}

function validatePayload(p: ScPayload): string | null {
  if (!p.name) return 'El nombre es obligatorio.'
  if (!p.slug)
    return 'El nombre no genera un slug válido — usá letras o números.'
  return null
}

function revalidateSistemas(id?: string) {
  revalidatePath('/admin/sistemas')
  revalidatePath('/admin')
  // El catálogo público lee el panel SC tanto en home como en el agregador.
  revalidatePath('/')
  revalidatePath('/catalogo')
  if (id) revalidatePath(`/admin/sistemas/${id}`)
}

type Result = { error: string | null }

// ---------------------------------------------------------------------------
// createSistemaConstructivo
// ---------------------------------------------------------------------------

export async function createSistemaConstructivo(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(formData, {})
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Unicidad (marca_id, slug). marca_id NULL es distinguible.
  let dupQuery = admin
    .from('sistema_constructivo_content')
    .select('id')
    .eq('slug', payload.slug)
  dupQuery = payload.marca_id
    ? dupQuery.eq('marca_id', payload.marca_id)
    : dupQuery.is('marca_id', null)
  const { data: existing } = await dupQuery.maybeSingle()

  if (existing) {
    return {
      error: `Ya existe un sistema "${payload.name}" (slug ${payload.slug}) en ${
        payload.marca_id ? 'esa marca' : 'el ámbito compartido'
      }.`,
    }
  }

  const { data: inserted, error } = await admin
    .from('sistema_constructivo_content')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un sistema con ese nombre y ámbito.' }
    }
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateSistemas()
  redirect(`/admin/sistemas/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateSistemaConstructivo
// slug y marca_id NO se editan — se pasan por bind desde el page.
// ---------------------------------------------------------------------------

export async function updateSistemaConstructivo(
  id: string,
  currentSlug: string,
  currentMarcaId: string | null,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(formData, {
    lockSlug: currentSlug,
    lockMarca: currentMarcaId,
  })
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { error } = await admin
    .from('sistema_constructivo_content')
    .update(payload)
    .eq('id', id)

  if (error) {
    return { error: `Error al actualizar: ${error.message}` }
  }

  revalidateSistemas(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// deleteSistemaConstructivo
// Borrar una fila hace que el catálogo caiga al fallback (compartido o legacy).
// ---------------------------------------------------------------------------

export async function deleteSistemaConstructivo(id: string): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('sistema_constructivo_content')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateSistemas()
  redirect('/admin/sistemas')
}

// ---------------------------------------------------------------------------
// uploadScImage / removeScImage
// Foto de fondo de la columna SC. Bucket `sc-images`. Mismo patrón que
// uploadLineaIcon. Si no hay foto, el catálogo cae a la foto del pool.
// ---------------------------------------------------------------------------

const SC_BUCKET = 'sc-images'
const SC_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const SC_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp']

export type ScImageActionResult =
  | { ok: true; heroImageUrl: string | null }
  | { ok: false; error: string }

function sanitizeFilename(name: string): string {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    normalized
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'sc'
  )
}

function scStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${SC_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function uploadScImage(
  scId: string,
  formData: FormData,
): Promise<ScImageActionResult> {
  if (!scId) return { ok: false, error: 'Falta el ID del sistema.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!SC_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. Usá PNG, JPG o WebP.' }
  }
  if (file.size > SC_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 5 MB.' }
  }

  const admin = createAdminClient()

  const { data: row, error: fetchErr } = await admin
    .from('sistema_constructivo_content')
    .select('id, hero_image_url')
    .eq('id', scId)
    .maybeSingle()

  if (fetchErr)
    return { ok: false, error: `Error verificando el sistema: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El sistema no existe.' }

  const safeName = sanitizeFilename(file.name)
  const storagePath = `${scId}/${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(SC_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage
    .from(SC_BUCKET)
    .getPublicUrl(storagePath)
  const heroImageUrl = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('sistema_constructivo_content')
    .update({ hero_image_url: heroImageUrl })
    .eq('id', scId)

  if (updateErr) {
    await admin.storage.from(SC_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar el sistema: ${updateErr.message}` }
  }

  const previousPath = scStoragePathFromUrl(row.hero_image_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(SC_BUCKET).remove([previousPath])
  }

  revalidateSistemas(scId)
  return { ok: true, heroImageUrl }
}

export async function removeScImage(
  scId: string,
): Promise<ScImageActionResult> {
  if (!scId) return { ok: false, error: 'Falta el ID del sistema.' }

  const admin = createAdminClient()

  const { data: row, error: fetchErr } = await admin
    .from('sistema_constructivo_content')
    .select('id, hero_image_url')
    .eq('id', scId)
    .maybeSingle()

  if (fetchErr)
    return { ok: false, error: `Error verificando el sistema: ${fetchErr.message}` }
  if (!row) return { ok: false, error: 'El sistema no existe.' }

  const previousPath = scStoragePathFromUrl(row.hero_image_url ?? null)

  const { error: updateErr } = await admin
    .from('sistema_constructivo_content')
    .update({ hero_image_url: null })
    .eq('id', scId)

  if (updateErr) {
    return { ok: false, error: `Error al actualizar el sistema: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(SC_BUCKET).remove([previousPath])
  }

  revalidateSistemas(scId)
  return { ok: true, heroImageUrl: null }
}
