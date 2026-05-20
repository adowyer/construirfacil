'use server'

/**
 * app/admin/lineas/actions.ts
 *
 * Server Actions para CRUD sobre `lineas` desde el panel admin.
 * Cada write hace upsert atómico también en `line_content` para mantener
 * los textos editoriales sincronizados con la entidad línea.
 *
 * Convención: line_content.linea guarda el `name` de la línea normalizado
 * (uppercase + trim). Coincide con lo que el trigger sync_house_catalog_denorm
 * escribe en house_catalog.linea, así el catálogo público joinea bien.
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

function normalizeLineaName(name: string): string {
  return name.trim().toUpperCase()
}

type LineaPayload = {
  marca_id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  hero_image_url: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  // editorial (line_content)
  tipologia_code: string | null
  title: string | null
  subtitle: string | null
}

function buildPayload(formData: FormData): LineaPayload {
  const rawName = parseRequiredText(formData.get('name'))
  const name = normalizeLineaName(rawName)
  const slugInput = parseOptionalText(formData.get('slug'))
  const slug = slugInput ?? slugify(name)
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'

  return {
    marca_id: parseRequiredText(formData.get('marca_id')),
    name,
    slug,
    tagline: parseOptionalText(formData.get('tagline')),
    description: parseOptionalText(formData.get('description')),
    hero_image_url: parseOptionalText(formData.get('hero_image_url')),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
    tipologia_code: parseOptionalText(formData.get('tipologia_code')),
    title: parseOptionalText(formData.get('title')),
    subtitle: parseOptionalText(formData.get('subtitle')),
  }
}

function validatePayload(p: LineaPayload): string | null {
  if (!p.marca_id) return 'Tenés que elegir una marca.'
  if (!p.name) return 'El nombre es obligatorio.'
  if (!p.slug) return 'El slug no se pudo generar — ingresá uno manualmente.'
  return null
}

function revalidateLineas(id?: string) {
  revalidatePath('/admin/lineas')
  revalidatePath('/admin')
  // El catálogo público lee line_content para los sliders.
  revalidatePath('/')
  if (id) revalidatePath(`/admin/lineas/${id}`)
}

type LineaResult = { error: string | null }

// ---------------------------------------------------------------------------
// upsertLineContent
// Centraliza la escritura editorial. Usa el UNIQUE(linea, tipologia_code)
// (con NULLS NOT DISTINCT) declarado en 0005_content_tables.sql.
// ---------------------------------------------------------------------------

async function upsertLineContent(
  admin: ReturnType<typeof createAdminClient>,
  payload: LineaPayload,
): Promise<{ error: string | null }> {
  // marca_id NULL = contenido GLOBAL. La línea ya pertenece a una marca,
  // pero seguimos escribiendo global para no vaciar el agregador (las filas
  // existentes son globales y el catálogo resuelve "marca > global"). El
  // schema soporta per-marca; autoría per-marca de línea queda como
  // refinamiento futuro. onConflict debe incluir marca_id (UNIQUE de 0020).
  const row = {
    marca_id: null as string | null,
    linea: payload.name,
    tipologia_code: payload.tipologia_code,
    title: payload.title,
    subtitle: payload.subtitle,
    body: payload.description,
    sort_order: payload.sort_order,
    status: payload.status,
  }

  const { error } = await admin
    .from('line_content')
    .upsert(row, { onConflict: 'marca_id,linea,tipologia_code' })

  if (error) {
    return { error: `Error al guardar el contenido editorial: ${error.message}` }
  }
  return { error: null }
}

// ---------------------------------------------------------------------------
// createLinea
// ---------------------------------------------------------------------------

export async function createLinea(
  _prevState: LineaResult,
  formData: FormData,
): Promise<LineaResult> {
  const admin = createAdminClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Slug único por marca (UNIQUE (marca_id, slug) ya en DB).
  const { data: existing } = await admin
    .from('lineas')
    .select('id')
    .eq('marca_id', payload.marca_id)
    .eq('slug', payload.slug)
    .maybeSingle()

  if (existing) {
    return {
      error: `Ya existe una línea con slug "${payload.slug}" en esta marca.`,
    }
  }

  const { data: inserted, error } = await admin
    .from('lineas')
    .insert({
      marca_id: payload.marca_id,
      name: payload.name,
      slug: payload.slug,
      tagline: payload.tagline,
      description: payload.description,
      hero_image_url: payload.hero_image_url,
      sort_order: payload.sort_order,
      status: payload.status,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una línea con slug "${payload.slug}" en esta marca.` }
    }
    return { error: `Error al crear la línea: ${error.message}` }
  }

  // Editorial: solo si trae algún campo editorial.
  const hasEditorial =
    payload.title !== null ||
    payload.subtitle !== null ||
    payload.description !== null ||
    payload.tipologia_code !== null
  if (hasEditorial) {
    const r = await upsertLineContent(admin, payload)
    if (r.error) return { error: r.error }
  }

  revalidateLineas()
  redirect(`/admin/lineas/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateLinea
// ---------------------------------------------------------------------------

export async function updateLinea(
  id: string,
  _prevState: LineaResult,
  formData: FormData,
): Promise<LineaResult> {
  const admin = createAdminClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Slug único por marca, excluyendo la fila actual.
  const { data: existing } = await admin
    .from('lineas')
    .select('id')
    .eq('marca_id', payload.marca_id)
    .eq('slug', payload.slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) {
    return {
      error: `Ya existe otra línea con slug "${payload.slug}" en esta marca.`,
    }
  }

  const { error } = await admin
    .from('lineas')
    .update({
      marca_id: payload.marca_id,
      name: payload.name,
      slug: payload.slug,
      tagline: payload.tagline,
      description: payload.description,
      hero_image_url: payload.hero_image_url,
      sort_order: payload.sort_order,
      status: payload.status,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe otra línea con slug "${payload.slug}" en esta marca.` }
    }
    return { error: `Error al actualizar la línea: ${error.message}` }
  }

  // Editorial: siempre upsert en update (escribe lo que mandó el form,
  // incluyendo limpiar campos a null).
  const r = await upsertLineContent(admin, payload)
  if (r.error) return { error: r.error }

  revalidateLineas(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// uploadLineaIcon / removeLineaIcon
// Sube el ícono representativo de la línea al bucket `linea-icons` y
// actualiza lineas.icon_url. Mismo patrón que uploadMarcaLogo.
// ---------------------------------------------------------------------------

const ICON_BUCKET = 'linea-icons'
const ICON_MAX_BYTES = 200 * 1024 // 200 KB
const ICON_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export type IconActionResult =
  | { ok: true; iconUrl: string | null }
  | { ok: false; error: string }

function sanitizeFilename(name: string): string {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    normalized
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'icon'
  )
}

/** Devuelve el storage_path relativo al bucket si la URL apunta a linea-icons. */
function iconStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${ICON_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function uploadLineaIcon(
  lineaId: string,
  formData: FormData,
): Promise<IconActionResult> {
  if (!lineaId) return { ok: false, error: 'Falta el ID de la línea.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!ICON_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. Usá PNG, JPG, WebP o SVG.' }
  }
  if (file.size > ICON_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 200 KB.' }
  }

  const admin = createAdminClient()

  // Verificar que la línea existe (y traer icon_url anterior para limpieza).
  const { data: linea, error: fetchErr } = await admin
    .from('lineas')
    .select('id, icon_url')
    .eq('id', lineaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la línea: ${fetchErr.message}` }
  if (!linea) return { ok: false, error: 'La línea no existe.' }

  const safeName = sanitizeFilename(file.name)
  const storagePath = `${lineaId}/${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(ICON_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage
    .from(ICON_BUCKET)
    .getPublicUrl(storagePath)
  const iconUrl = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('lineas')
    .update({ icon_url: iconUrl })
    .eq('id', lineaId)

  if (updateErr) {
    // Rollback del archivo si falla el update.
    await admin.storage.from(ICON_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar la línea: ${updateErr.message}` }
  }

  // Limpieza del ícono anterior (best-effort).
  const previousPath = iconStoragePathFromUrl(linea.icon_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(ICON_BUCKET).remove([previousPath])
  }

  revalidateLineas(lineaId)
  return { ok: true, iconUrl }
}

export async function removeLineaIcon(lineaId: string): Promise<IconActionResult> {
  if (!lineaId) return { ok: false, error: 'Falta el ID de la línea.' }

  const admin = createAdminClient()

  const { data: linea, error: fetchErr } = await admin
    .from('lineas')
    .select('id, icon_url')
    .eq('id', lineaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la línea: ${fetchErr.message}` }
  if (!linea) return { ok: false, error: 'La línea no existe.' }

  const previousPath = iconStoragePathFromUrl(linea.icon_url ?? null)

  const { error: updateErr } = await admin
    .from('lineas')
    .update({ icon_url: null })
    .eq('id', lineaId)

  if (updateErr) {
    return { ok: false, error: `Error al actualizar la línea: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(ICON_BUCKET).remove([previousPath])
  }

  revalidateLineas(lineaId)
  return { ok: true, iconUrl: null }
}

// ---------------------------------------------------------------------------
// deleteLinea
// Elimina la fila en `lineas`. Los modelos asociados quedan con
// linea_id NULL (FK ON DELETE SET NULL).
// El line_content NO se borra automáticamente — un line_content puede
// servir a múltiples instancias futuras de una línea con el mismo nombre.
// Si querés limpiarlo manualmente, hacelo desde la UI futura de line_content.
// ---------------------------------------------------------------------------

export async function deleteLinea(id: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await admin.from('lineas').delete().eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateLineas()
  redirect('/admin/lineas')
}

// ---------------------------------------------------------------------------
// updateLineContentTipologia
// Guarda title/subtitle/body para una fila de line_content keyed por
// (linea, tipologia_code) — ej. ('TERRA','estilos_intro'). Es la versión
// "secundaria" del editorial de línea: contenido por tipología que el
// catálogo público lee para slides específicos del expandido.
//
// La fila se crea si no existe (upsert con onConflict (linea,tipologia_code)
// declarado en 0005). Bound al (lineaName, tipologiaCode) desde el page
// con .bind para que el form solo envíe title/subtitle/body.
// ---------------------------------------------------------------------------

export async function updateLineContentTipologia(
  lineaName: string,
  tipologiaCode: string,
  lineaId: string, // para revalidar la page edit
  _prev: LineaResult,
  formData: FormData,
): Promise<LineaResult> {
  if (!lineaName || !tipologiaCode) {
    return { error: 'Falta linea o tipologia_code.' }
  }

  const admin = createAdminClient()

  // Global (marca_id NULL) — ver nota en upsertLineContent.
  const row = {
    marca_id: null as string | null,
    linea: normalizeLineaName(lineaName),
    tipologia_code: tipologiaCode,
    title: parseOptionalText(formData.get('title')),
    subtitle: parseOptionalText(formData.get('subtitle')),
    body: sanitizeRichTextOrNull(parseOptionalText(formData.get('body'))),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: (parseOptionalText(formData.get('status')) ?? 'active') as
      | 'active'
      | 'inactive'
      | 'archived',
  }

  const { error } = await admin
    .from('line_content')
    .upsert(row, { onConflict: 'marca_id,linea,tipologia_code' })

  if (error) {
    return { error: `Error al guardar: ${error.message}` }
  }

  revalidateLineas(lineaId)
  return { error: null }
}
