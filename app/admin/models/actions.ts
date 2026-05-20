'use server'

/**
 * app/admin/models/actions.ts
 *
 * Server Actions para CRUD sobre `house_catalog`.
 * Todas las escrituras usan el cliente service-role para bypass de RLS.
 *
 * Schema real (ver supabase/migrations/0002_marcas_lineas.sql + 02_import_models.mjs):
 *   sku (unique), marca_id (FK), linea_id (FK)
 *   style_name, variante, tipologia_code, segmento, estilo
 *   sistema_constructivo, area_m2, area_semicubierta_m2, floors
 *   bedrooms_label, min_bedrooms, max_bedrooms, bathrooms, toilette, parrilla, lavadero
 *   precio_lista_usd, precio_contado_usd, precio_pozo_usd, costo_plano_usd
 *   description, brochure_url, pdf_url, status
 *
 * El trigger `sync_house_catalog_denorm` sincroniza brand/linea TEXT desde las FKs.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return isNaN(n) ? null : n
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null
  const n = parseInt(String(value), 10)
  return isNaN(n) ? null : n
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseRequiredText(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim()
}

function parseOptionalUuid(value: FormDataEntryValue | null): string | null {
  const s = parseOptionalText(value)
  return s
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value !== null && String(value).length > 0
}

function parseAttributeIds(formData: FormData): string[] {
  // FormData.getAll('attribute_ids') devuelve todos los checkboxes marcados.
  // Filtramos vacíos y deduplicamos por las dudas.
  // Usamos 'attribute_ids' (no 'attributes') para evitar colisión con la
  // propiedad nativa form.attributes — ver AttributeSelector.tsx.
  const raw = formData.getAll('attribute_ids')
  const ids = raw
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
  return Array.from(new Set(ids))
}

async function replaceCatalogAttributes(
  admin: ReturnType<typeof createAdminClient>,
  houseCatalogId: string,
  attributeValueIds: string[],
): Promise<{ error: string | null }> {
  // Replace-set: borramos todo lo previo y volvemos a insertar.
  const { error: delErr } = await admin
    .from('house_catalog_attributes')
    .delete()
    .eq('house_catalog_id', houseCatalogId)

  if (delErr) {
    return { error: `Error al limpiar atributos previos: ${delErr.message}` }
  }

  if (attributeValueIds.length === 0) return { error: null }

  const rows = attributeValueIds.map((vid) => ({
    house_catalog_id: houseCatalogId,
    attribute_value_id: vid,
  }))

  const { error: insErr } = await admin
    .from('house_catalog_attributes')
    .insert(rows)

  if (insErr) {
    return { error: `Error al guardar atributos: ${insErr.message}` }
  }
  return { error: null }
}

type CatalogPayload = {
  sku: string
  marca_id: string | null
  linea_id: string | null
  style_name: string | null
  variante: string | null
  tipologia_code: string | null
  segmento: string | null
  estilo: string | null
  sistema_constructivo: string | null
  area_m2: number | null
  area_semicubierta_m2: number | null
  floors: number | null
  bedrooms_label: string | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  bathrooms: number | null
  toilette: boolean
  parrilla: boolean
  lavadero: string | null
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
  costo_plano_usd: number | null
  description: string | null
  brochure_url: string | null
  pdf_url: string | null
  status: string
  featured_rank: number | null
}

function buildPayload(formData: FormData): CatalogPayload {
  return {
    sku: parseRequiredText(formData.get('sku')),
    marca_id: parseOptionalUuid(formData.get('marca_id')),
    linea_id: parseOptionalUuid(formData.get('linea_id')),
    style_name: parseOptionalText(formData.get('style_name')),
    variante: parseOptionalText(formData.get('variante')),
    tipologia_code: parseOptionalText(formData.get('tipologia_code')),
    segmento: parseOptionalText(formData.get('segmento')),
    estilo: parseOptionalText(formData.get('estilo')),
    sistema_constructivo: parseOptionalText(formData.get('sistema_constructivo')),
    area_m2: parseOptionalNumber(formData.get('area_m2')),
    area_semicubierta_m2: parseOptionalNumber(formData.get('area_semicubierta_m2')),
    floors: parseOptionalInt(formData.get('floors')),
    bedrooms_label: parseOptionalText(formData.get('bedrooms_label')),
    min_bedrooms: parseOptionalInt(formData.get('min_bedrooms')),
    max_bedrooms: parseOptionalInt(formData.get('max_bedrooms')),
    bathrooms: parseOptionalInt(formData.get('bathrooms')),
    toilette: parseCheckbox(formData.get('toilette')),
    parrilla: parseCheckbox(formData.get('parrilla')),
    lavadero: parseOptionalText(formData.get('lavadero')),
    precio_lista_usd: parseOptionalNumber(formData.get('precio_lista_usd')),
    precio_contado_usd: parseOptionalNumber(formData.get('precio_contado_usd')),
    precio_pozo_usd: parseOptionalNumber(formData.get('precio_pozo_usd')),
    costo_plano_usd: parseOptionalNumber(formData.get('costo_plano_usd')),
    description: parseOptionalText(formData.get('description')),
    brochure_url: parseOptionalText(formData.get('brochure_url')),
    pdf_url: parseOptionalText(formData.get('pdf_url')),
    status: parseRequiredText(formData.get('status')) || 'active',
    featured_rank: parseOptionalInt(formData.get('featured_rank')),
  }
}

function validatePayload(p: CatalogPayload): string | null {
  if (!p.sku) return 'El SKU es obligatorio.'
  if (!p.style_name) return 'El style_name es obligatorio.'
  if (!p.marca_id) return 'La marca es obligatoria.'
  return null
}

// ---------------------------------------------------------------------------
// createModel
// ---------------------------------------------------------------------------

export async function createModel(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }
  const attributeIds = parseAttributeIds(formData)

  // Uniqueness check por sku
  const { data: existing } = await admin
    .from('house_catalog')
    .select('id')
    .eq('sku', payload.sku)
    .maybeSingle()

  if (existing) {
    return { error: `El SKU "${payload.sku}" ya existe. Elegí un SKU único.` }
  }

  const { data: inserted, error } = await admin
    .from('house_catalog')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `El SKU "${payload.sku}" ya existe. Elegí un SKU único.` }
    }
    return { error: `Error al crear el modelo: ${error.message}` }
  }

  if (attributeIds.length > 0) {
    const r = await replaceCatalogAttributes(admin, inserted.id, attributeIds)
    if (r.error) return { error: r.error }
  }

  revalidatePath('/admin/models')
  revalidatePath('/admin')
  redirect('/admin/models')
}

// ---------------------------------------------------------------------------
// updateModel
// ---------------------------------------------------------------------------

export async function updateModel(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }
  const attributeIds = parseAttributeIds(formData)

  // Uniqueness check por sku (excluyendo la fila actual)
  const { data: existing } = await admin
    .from('house_catalog')
    .select('id')
    .eq('sku', payload.sku)
    .neq('id', id)
    .maybeSingle()

  if (existing) {
    return { error: `El SKU "${payload.sku}" ya está en uso por otro modelo.` }
  }

  const { error } = await admin
    .from('house_catalog')
    .update(payload)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `El SKU "${payload.sku}" ya está en uso por otro modelo.` }
    }
    return { error: `Error al actualizar el modelo: ${error.message}` }
  }

  // Replace-set de atributos siempre (incluye limpiar todos si el usuario
  // desmarcó todo).
  const r = await replaceCatalogAttributes(admin, id, attributeIds)
  if (r.error) return { error: r.error }

  revalidatePath('/admin/models')
  revalidatePath(`/admin/models/${id}`)
  revalidatePath('/admin')
  redirect('/admin/models')
}

// ---------------------------------------------------------------------------
// deleteModel
// ---------------------------------------------------------------------------

export async function deleteModel(id: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('house_catalog').delete().eq('id', id)
  revalidatePath('/admin/models')
  revalidatePath('/admin')
  redirect('/admin/models')
}

// ---------------------------------------------------------------------------
// setModelStatus
// ---------------------------------------------------------------------------

export async function setModelStatus(
  id: string,
  status: 'active' | 'inactive' | 'archived',
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('house_catalog').update({ status }).eq('id', id)
  revalidatePath('/admin/models')
  revalidatePath('/admin')
}

// ---------------------------------------------------------------------------
// updateModelPrice — edición inline del listado (/admin/models)
// Acepta un solo campo a la vez (lista/contado/pozo) y devuelve el nuevo
// valor parseado para que el cliente reconcilie su estado optimista. Si el
// usuario manda string vacío, guardamos NULL (sin precio).
// ---------------------------------------------------------------------------

type PriceField = 'precio_lista_usd' | 'precio_contado_usd' | 'precio_pozo_usd'

const PRICE_FIELDS: ReadonlySet<PriceField> = new Set([
  'precio_lista_usd',
  'precio_contado_usd',
  'precio_pozo_usd',
])

export async function updateModelPrice(
  id: string,
  field: PriceField,
  rawValue: string,
): Promise<{ error: string | null; value: number | null }> {
  if (!PRICE_FIELDS.has(field)) {
    return { error: `Campo inválido: ${field}`, value: null }
  }

  const trimmed = rawValue.trim()
  let value: number | null
  if (trimmed === '') {
    value = null
  } else {
    // Tolerante a formato es-AR ("145.272,6" → 145272.6) y formato simple.
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    if (!Number.isFinite(n) || n < 0) {
      return { error: 'El precio debe ser un número ≥ 0.', value: null }
    }
    value = Math.round(n * 100) / 100
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('house_catalog')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    return { error: `Error al guardar: ${error.message}`, value: null }
  }

  // OJO: NO llamamos revalidatePath acá. Hacerlo dispara un re-render del
  // server component que puede remontar el `<InlinePriceCell>` con el prop
  // `initial` resuelto del cache → la celda muestra brevemente el ✓ y vuelve
  // al valor anterior. El admin page revalida la próxima vez que se navega
  // (y el catálogo público también: tiene force-dynamic en sus páginas).
  return { error: null, value }
}
