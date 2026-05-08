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

const STORAGE_BUCKET = 'house-photos'
// Tipos válidos según el check constraint del schema (post-migración 0013).
const ALLOWED_IMAGE_TYPES = ['render', 'plano', 'axo'] as const
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

// ---------------------------------------------------------------------------
// setCoverImage
// ---------------------------------------------------------------------------
// Nota: el catálogo público no usa is_cover (usa sort_order). Esta action
// es solo bookkeeping del admin para marcar visualmente "la portada de la
// tipología". Limpia is_cover en imágenes linkeadas a cualquier SKU de la
// tipología y marca esta.

export async function setCoverImage(
  imageId: string,
  typology: { linea: string; tipologiaCode: string },
  modelId: string,
): Promise<ActionResult> {
  if (!imageId || !typology.linea || !typology.tipologiaCode) {
    return { ok: false, error: 'Datos insuficientes para marcar portada.' }
  }

  const admin = createAdminClient()

  // Verificar que la imagen existe.
  const { data: target, error: fetchErr } = await admin
    .from('model_images')
    .select('id')
    .eq('id', imageId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: `Error verificando imagen: ${fetchErr.message}` }
  if (!target) return { ok: false, error: 'La imagen no existe.' }

  // Encontrar todos los SKUs de la tipología.
  const { data: skuRows, error: skuErr } = await admin
    .from('house_catalog')
    .select('id')
    .eq('linea', typology.linea)
    .eq('tipologia_code', typology.tipologiaCode)
  if (skuErr) {
    return { ok: false, error: `Error buscando SKUs de la tipología: ${skuErr.message}` }
  }
  const skuIds = (skuRows ?? []).map((r: { id: string }) => r.id)

  // Encontrar todas las imágenes linkeadas a esos SKUs (vía model_image_skus).
  let imageIdsInTypology: string[] = []
  if (skuIds.length > 0) {
    const { data: linkRows, error: linkErr } = await admin
      .from('model_image_skus')
      .select('image_id')
      .in('house_catalog_id', skuIds)
    if (linkErr) {
      return { ok: false, error: `Error buscando links: ${linkErr.message}` }
    }
    imageIdsInTypology = Array.from(
      new Set((linkRows ?? []).map((r: { image_id: string }) => r.image_id)),
    )
  }

  // Paso 1: desmarcar cualquier cover previo en esa tipología.
  if (imageIdsInTypology.length > 0) {
    const { error: clearErr } = await admin
      .from('model_images')
      .update({ is_cover: false })
      .in('id', imageIdsInTypology)
      .eq('is_cover', true)
    if (clearErr) {
      return { ok: false, error: `No se pudo desmarcar la portada anterior: ${clearErr.message}` }
    }
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
// setImageSkuLinks
// ---------------------------------------------------------------------------
// Reemplaza atómicamente los links de una imagen en model_image_skus.
// Si houseCatalogIds está vacío, la imagen queda huérfana (sin SKU).
// Idempotente — el caller envía siempre el set completo, no diffs.

export async function setImageSkuLinks(
  imageId: string,
  houseCatalogIds: string[],
  modelId: string,
): Promise<ActionResult> {
  if (!imageId) return { ok: false, error: 'Falta el ID de la imagen.' }

  const admin = createAdminClient()

  // Verificar que la imagen existe.
  const { data: img, error: fetchErr } = await admin
    .from('model_images')
    .select('id')
    .eq('id', imageId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: `Error verificando imagen: ${fetchErr.message}` }
  if (!img) return { ok: false, error: 'La imagen no existe.' }

  // Replace all: delete existing + insert new set.
  // Si falla el insert, los links quedan vacíos — el caller puede reintentar.
  const { error: delErr } = await admin
    .from('model_image_skus')
    .delete()
    .eq('image_id', imageId)
  if (delErr) {
    return { ok: false, error: `Error limpiando links: ${delErr.message}` }
  }

  if (houseCatalogIds.length > 0) {
    const rows = houseCatalogIds.map((hcid) => ({
      image_id: imageId,
      house_catalog_id: hcid,
    }))
    const { error: insErr } = await admin.from('model_image_skus').insert(rows)
    if (insErr) {
      return { ok: false, error: `Error creando links: ${insErr.message}` }
    }
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

  const { data: insertedRow, error: insertErr } = await admin
    .from('model_images')
    .insert({
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
    .select('id')
    .single()

  if (insertErr || !insertedRow) {
    // Rollback del archivo en Storage si falla el insert.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath])
    return {
      ok: false,
      error: `Error al guardar la imagen: ${insertErr?.message ?? 'sin id devuelto'}`,
    }
  }

  // Linkear la imagen recién creada a los SKUs seleccionados (model_image_skus).
  // El campo `house_catalog_ids` viene como CSV de uuids desde el form.
  const houseCatalogIdsRaw = String(formData.get('house_catalog_ids') ?? '').trim()
  const houseCatalogIds = houseCatalogIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (houseCatalogIds.length > 0) {
    const linkRows = houseCatalogIds.map((hcid) => ({
      image_id: insertedRow.id,
      house_catalog_id: hcid,
    }))
    const { error: linkErr } = await admin.from('model_image_skus').insert(linkRows)
    if (linkErr) {
      // No revertimos el insert ni el storage — la imagen quedó subida pero
      // sin links. El admin la puede vincular manualmente desde la galería.
      revalidateAll(modelId)
      return {
        ok: false,
        error: `Imagen subida pero falló el linkeo a SKUs: ${linkErr.message}. Vinculala desde la galería.`,
      }
    }
  }

  revalidateAll(modelId)
  return { ok: true }
}
