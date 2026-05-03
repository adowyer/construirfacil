'use server'

/**
 * app/admin/models/[id]/image-actions.ts
 *
 * Server Actions for managing rows of the `model_images` table tied to a
 * single house_catalog entry (matched by linea + tipologia_code + style_name).
 *
 * Why a separate file from `app/admin/models/actions.ts`:
 *   - The model CRUD actions return `{ error: string | null }` and call
 *     `redirect()` (one-shot navigation flow tied to `useActionState`).
 *   - Image actions return `{ ok: true } | { ok: false, error }` and stay on
 *     the same page (per-thumbnail mutations + revalidation). Mixing both
 *     contracts in the same module made the existing actions.ts messy.
 *
 * All writes use the service-role admin client to bypass RLS. They are
 * reachable via direct POST so every action validates the row exists and
 * constructs storage paths server-side (clients cannot smuggle paths).
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * 4 campos que identifican el "scope" de una imagen en `model_images`.
 * `sistema_constructivo` NO se incluye — Drive no separa por sistema y
 * todas las filas tienen sistema=NULL.
 */
export type ModelGroupKey = {
  linea: string
  tipologiaCode: string
  styleName: string | null
  variante: string | null
}

const STORAGE_BUCKET = 'house-photos'
const ALLOWED_IMAGE_TYPES = ['render', 'plano', 'axonometria'] as const
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename: lowercase, strip diacritics, replace whitespace with `-`,
 * keep only alphanumerics, dots, underscores and hyphens.
 */
function sanitizeFilename(name: string): string {
  // Strip diacritics (NFD) → drop combining marks (U+0300 — U+036F)
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return normalized
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    || 'image'
}

function revalidateAll(modelId: string) {
  revalidatePath('/admin/models')
  revalidatePath(`/admin/models/${modelId}`)
  revalidatePath('/')
  revalidatePath('/admin')
}

/**
 * Aplica un filtro de los 4 campos del grupo a un query de Supabase.
 * Usa .is(null) para campos null y .eq() para los demás.
 */
function applyGroupFilter<Q extends {
  eq: (col: string, val: string) => Q
  is: (col: string, val: null) => Q
}>(query: Q, group: ModelGroupKey): Q {
  let q = query.eq('linea', group.linea).eq('tipologia_code', group.tipologiaCode)
  q = group.styleName === null ? q.is('style_name', null) : q.eq('style_name', group.styleName)
  q = group.variante === null ? q.is('variante', null) : q.eq('variante', group.variante)
  return q
}

function rowMatchesGroup(
  row: {
    linea: string
    tipologia_code: string
    style_name: string | null
    variante: string | null
  },
  group: ModelGroupKey,
): boolean {
  return (
    row.linea === group.linea &&
    row.tipologia_code === group.tipologiaCode &&
    (row.style_name ?? null) === (group.styleName ?? null) &&
    (row.variante ?? null) === (group.variante ?? null)
  )
}

// ---------------------------------------------------------------------------
// setCoverImage
// ---------------------------------------------------------------------------

export async function setCoverImage(
  imageId: string,
  group: ModelGroupKey,
  modelId: string,
): Promise<ActionResult> {
  if (!imageId || !group.linea || !group.tipologiaCode) {
    return { ok: false, error: 'Datos insuficientes para marcar portada.' }
  }

  const admin = createAdminClient()

  // Verificar que la fila pertenece a este modelo (4 campos del scope).
  const { data: target, error: fetchErr } = await admin
    .from('model_images')
    .select('id, linea, tipologia_code, style_name, variante')
    .eq('id', imageId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando imagen: ${fetchErr.message}` }
  if (!target) return { ok: false, error: 'La imagen no existe.' }
  if (!rowMatchesGroup(target, group)) {
    return { ok: false, error: 'La imagen no pertenece a este modelo.' }
  }

  // Paso 1: desmarcar cualquier cover previo para este modelo (5 campos).
  const clearQuery = applyGroupFilter(
    admin.from('model_images').update({ is_cover: false }).eq('is_cover', true),
    group,
  )
  const { error: clearErr } = await clearQuery
  if (clearErr) {
    return { ok: false, error: `No se pudo desmarcar la portada anterior: ${clearErr.message}` }
  }

  // Paso 2: marcar la fila elegida.
  const { error: setErr } = await admin
    .from('model_images')
    .update({ is_cover: true })
    .eq('id', imageId)

  if (setErr) {
    return { ok: false, error: `No se pudo marcar la portada: ${setErr.message}` }
  }

  revalidateAll(modelId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// setImageType
// ---------------------------------------------------------------------------

export async function setImageType(
  imageId: string,
  imageType: string,
  modelId: string,
): Promise<ActionResult> {
  if (!imageId) return { ok: false, error: 'Falta el ID de la imagen.' }

  if (!ALLOWED_IMAGE_TYPES.includes(imageType as AllowedImageType)) {
    return {
      ok: false,
      error: `Tipo inválido. Usá uno de: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
    }
  }

  const admin = createAdminClient()

  const { data: target, error: fetchErr } = await admin
    .from('model_images')
    .select('id')
    .eq('id', imageId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: `Error verificando imagen: ${fetchErr.message}` }
  if (!target) return { ok: false, error: 'La imagen no existe.' }

  const { error } = await admin
    .from('model_images')
    .update({ image_type: imageType })
    .eq('id', imageId)

  if (error) return { ok: false, error: `Error al actualizar tipo: ${error.message}` }

  revalidateAll(modelId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// archiveImage
// ---------------------------------------------------------------------------

export async function archiveImage(
  imageId: string,
  modelId: string,
): Promise<ActionResult> {
  if (!imageId) return { ok: false, error: 'Falta el ID de la imagen.' }

  const admin = createAdminClient()

  const { data: target, error: fetchErr } = await admin
    .from('model_images')
    .select('id, is_cover')
    .eq('id', imageId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: `Error verificando imagen: ${fetchErr.message}` }
  if (!target) return { ok: false, error: 'La imagen no existe.' }

  // If we're archiving the cover, clear the flag so no archived row stays "cover".
  const payload: { status: string; is_cover?: boolean } = { status: 'archived' }
  if (target.is_cover) payload.is_cover = false

  const { error } = await admin
    .from('model_images')
    .update(payload)
    .eq('id', imageId)

  if (error) return { ok: false, error: `Error al archivar: ${error.message}` }

  revalidateAll(modelId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------

export async function uploadImage(formData: FormData): Promise<ActionResult> {
  const file = formData.get('file')
  const modelId = String(formData.get('model_id') ?? '').trim()
  const linea = String(formData.get('linea') ?? '').trim()
  const tipologiaCode = String(formData.get('tipologia_code') ?? '').trim()

  const styleNameRaw = formData.get('style_name')
  const styleName =
    styleNameRaw === null || styleNameRaw === '' ? null : String(styleNameRaw).trim()
  const varianteRaw = formData.get('variante')
  const variante =
    varianteRaw === null || varianteRaw === '' ? null : String(varianteRaw).trim()
  const sistemaConstructivoRaw = formData.get('sistema_constructivo')
  const sistemaConstructivo =
    sistemaConstructivoRaw === null || sistemaConstructivoRaw === ''
      ? null
      : String(sistemaConstructivoRaw).trim()

  const isExterior = formData.get('is_exterior') === 'on' || formData.get('is_exterior') === 'true'
  const imageTypeRaw = String(formData.get('image_type') ?? 'render').trim()
  const sortOrderRaw = formData.get('sort_order')
  const sortOrder = sortOrderRaw == null || sortOrderRaw === '' ? 0 : Number(sortOrderRaw)

  if (!modelId) return { ok: false, error: 'Falta el ID del modelo.' }
  if (!linea || !tipologiaCode) {
    return { ok: false, error: 'El modelo no tiene línea o tipología; no se puede subir la imagen.' }
  }
  if (!ALLOWED_IMAGE_TYPES.includes(imageTypeRaw as AllowedImageType)) {
    return {
      ok: false,
      error: `Tipo inválido. Usá uno de: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
    }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'El archivo debe ser una imagen.' }
  }
  if (Number.isNaN(sortOrder)) {
    return { ok: false, error: 'El orden debe ser un número.' }
  }

  const admin = createAdminClient()

  // Path en Storage controlado por el server. Estructura:
  //   {linea}/{tipologia}/{style}/{variante}/{sistema}/{timestamp}-{filename}
  const safeName = sanitizeFilename(file.name)
  const segments = [
    sanitizeFilename(linea),
    sanitizeFilename(tipologiaCode),
    styleName ? sanitizeFilename(styleName) : '_no-style',
    variante ? sanitizeFilename(variante) : '_no-variante',
    sistemaConstructivo ? sanitizeFilename(sistemaConstructivo) : '_no-sistema',
    `${Date.now()}-${safeName}`,
  ]
  const storagePath = segments.join('/')

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  const storageUrl = publicUrlData.publicUrl

  const { error: insertErr } = await admin.from('model_images').insert({
    linea,
    tipologia_code: tipologiaCode,
    style_name: styleName,
    variante,
    sistema_constructivo: sistemaConstructivo,
    is_exterior: isExterior,
    image_type: imageTypeRaw,
    is_cover: false,
    sort_order: sortOrder,
    storage_path: storagePath,
    storage_url: storageUrl,
    status: 'active',
    drive_file_id: null,
    drive_path: null,
  })

  if (insertErr) {
    // Rollback del archivo en Storage si falla el insert.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al guardar la imagen: ${insertErr.message}` }
  }

  revalidateAll(modelId)
  return { ok: true }
}
