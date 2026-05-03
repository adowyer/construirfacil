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
  const row = {
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
    .upsert(row, { onConflict: 'linea,tipologia_code' })

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
