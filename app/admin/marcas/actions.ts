'use server'

/**
 * app/admin/marcas/actions.ts
 *
 * Server Actions para CRUD sobre `marcas` desde el panel admin.
 * Todas las escrituras usan service-role admin client (bypass RLS).
 *
 * Owner: para crear una marca desde admin, owner_id default es el admin actual.
 * El admin puede transferir ownership editando manualmente vía SQL si hace falta.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

type MarcaPayload = {
  name: string
  slug: string
  description: string | null
  website_url: string | null
  phone: string | null
  city: string | null
  province: string | null
  show_prices: boolean
}

// NOTA: `logo_url` NO se incluye acá. Lo gestiona el uploader dedicado
// (uploadMarcaLogo / removeMarcaLogo). Si lo metiéramos en el payload, el
// form lo blanquearía cada vez que se guarda, pisando lo que subió el uploader.
function buildPayload(formData: FormData): MarcaPayload {
  const name = parseRequiredText(formData.get('name'))
  const slugInput = parseOptionalText(formData.get('slug'))
  const slug = slugInput ?? slugify(name)
  return {
    name,
    slug,
    description: parseOptionalText(formData.get('description')),
    website_url: parseOptionalText(formData.get('website_url')),
    phone: parseOptionalText(formData.get('phone')),
    city: parseOptionalText(formData.get('city')),
    province: parseOptionalText(formData.get('province')),
    show_prices: formData.get('show_prices') === 'on',
  }
}

function validatePayload(p: MarcaPayload): string | null {
  if (!p.name) return 'El nombre es obligatorio.'
  if (!p.slug) return 'El slug no se pudo generar — ingresá uno manualmente.'
  return null
}

function revalidateMarcas(id?: string) {
  revalidatePath('/admin/marcas')
  revalidatePath('/admin')
  if (id) revalidatePath(`/admin/marcas/${id}`)
}

// ---------------------------------------------------------------------------
// createMarca
// ---------------------------------------------------------------------------

export async function createMarca(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const server = await createClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Owner default: admin actual
  const {
    data: { user },
  } = await server.auth.getUser()

  if (!user) return { error: 'No hay sesión activa.' }

  // Slug uniqueness check
  const { data: existing } = await admin
    .from('marcas')
    .select('id')
    .eq('slug', payload.slug)
    .maybeSingle()

  if (existing) {
    return { error: `El slug "${payload.slug}" ya existe. Elegí uno distinto.` }
  }

  const { data: inserted, error } = await admin
    .from('marcas')
    .insert({
      ...payload,
      owner_id: user.id,
      status: 'approved', // marca creada por admin → ya aprobada
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `El slug "${payload.slug}" ya existe. Elegí uno distinto.` }
    }
    return { error: `Error al crear la marca: ${error.message}` }
  }

  revalidateMarcas()
  redirect(`/admin/marcas/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateMarca
// ---------------------------------------------------------------------------

export async function updateMarca(
  id: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Slug uniqueness (excluyendo la fila actual)
  const { data: existing } = await admin
    .from('marcas')
    .select('id')
    .eq('slug', payload.slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) {
    return { error: `El slug "${payload.slug}" ya está en uso por otra marca.` }
  }

  const { error } = await admin
    .from('marcas')
    .update(payload)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `El slug "${payload.slug}" ya está en uso por otra marca.` }
    }
    return { error: `Error al actualizar la marca: ${error.message}` }
  }

  revalidateMarcas(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// approveMarca
// ---------------------------------------------------------------------------

export async function approveMarca(id: string): Promise<void> {
  const admin = createAdminClient()
  const server = await createClient()
  const {
    data: { user },
  } = await server.auth.getUser()

  await admin
    .from('marcas')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
      rejection_reason: null,
    })
    .eq('id', id)

  revalidateMarcas(id)
}

// ---------------------------------------------------------------------------
// rejectMarca
// ---------------------------------------------------------------------------

export async function rejectMarca(id: string, formData: FormData): Promise<void> {
  const admin = createAdminClient()
  const reason = parseOptionalText(formData.get('rejection_reason'))

  await admin
    .from('marcas')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_at: null,
      approved_by: null,
    })
    .eq('id', id)

  revalidateMarcas(id)
}

// ---------------------------------------------------------------------------
// Activos visuales de la marca — isologo (logo_url) e isotipo (iso_url)
// ---------------------------------------------------------------------------
// `logo_url` = ISOLOGO (símbolo + texto). `iso_url` = ISOTIPO (solo símbolo).
// Misma lógica de upload/remove, parametrizada por columna. El isologo conserva
// EXACTAMENTE su comportamiento previo (mismo bucket, mismo path en la raíz);
// el isotipo va bajo el subfolder `iso/` para no colisionar.
//
// Estas actions usan service-role. Como ahora también se exponen en el portal
// self-service, se agrega un guard de autorización (admin OR dueño de la marca)
// que NO altera el flujo del admin (un admin siempre pasa el guard).

const LOGO_BUCKET = 'marca-logos'
const IMG_MAX_BYTES = 2 * 1024 * 1024
const IMG_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

type MarcaImageField = 'logo_url' | 'iso_url'

export type MarcaImageActionResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string }

function sanitizeFilename(name: string): string {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    normalized
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'logo'
  )
}

/** storage_path relativo al bucket si la URL pública apunta al bucket de logos. */
function imageStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

/** logo → raíz (path histórico intacto); iso → subfolder `iso/`. */
function subfolderFor(field: MarcaImageField): string {
  return field === 'iso_url' ? 'iso/' : ''
}

/** Autoriza la operación: admin (cualquier marca) o el dueño de esa marca. */
async function assertCanManageMarca(
  marcaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const server = await createClient()
  const {
    data: { user },
  } = await server.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role === 'admin') return { ok: true }

  const { data: marca } = await admin
    .from('marcas')
    .select('owner_id')
    .eq('id', marcaId)
    .maybeSingle()
  if (marca && marca.owner_id === user.id) return { ok: true }

  return { ok: false, error: 'No tenés permiso sobre esta marca.' }
}

async function uploadMarcaImage(
  marcaId: string,
  formData: FormData,
  field: MarcaImageField,
): Promise<MarcaImageActionResult> {
  if (!marcaId) return { ok: false, error: 'Falta el ID de la marca.' }

  const auth = await assertCanManageMarca(marcaId)
  if (!auth.ok) return auth

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!IMG_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. Usá PNG, JPG, WebP o SVG.' }
  }
  if (file.size > IMG_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 2 MB.' }
  }

  const admin = createAdminClient()

  // Verificar que la marca existe (y traer el valor anterior para limpieza).
  const { data: marca, error: fetchErr } = await admin
    .from('marcas')
    .select(`id, ${field}`)
    .eq('id', marcaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la marca: ${fetchErr.message}` }
  if (!marca) return { ok: false, error: 'La marca no existe.' }

  // Path: marca-logos/{marcaId}/[iso/]{timestamp}-{filename}
  const safeName = sanitizeFilename(file.name)
  const storagePath = `${marcaId}/${subfolderFor(field)}${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Error al subir el archivo: ${uploadErr.message}` }
  }

  const { data: publicUrlData } = admin.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(storagePath)
  const url = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('marcas')
    .update({ [field]: url })
    .eq('id', marcaId)

  if (updateErr) {
    // Rollback del archivo si falla el update.
    await admin.storage.from(LOGO_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar la marca: ${updateErr.message}` }
  }

  // Limpieza del activo anterior (best-effort).
  const prev = (marca as Record<string, string | null>)[field] ?? null
  const previousPath = imageStoragePathFromUrl(prev)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(LOGO_BUCKET).remove([previousPath])
  }

  revalidateMarcas(marcaId)
  return { ok: true, url }
}

async function removeMarcaImage(
  marcaId: string,
  field: MarcaImageField,
): Promise<MarcaImageActionResult> {
  if (!marcaId) return { ok: false, error: 'Falta el ID de la marca.' }

  const auth = await assertCanManageMarca(marcaId)
  if (!auth.ok) return auth

  const admin = createAdminClient()

  const { data: marca, error: fetchErr } = await admin
    .from('marcas')
    .select(`id, ${field}`)
    .eq('id', marcaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la marca: ${fetchErr.message}` }
  if (!marca) return { ok: false, error: 'La marca no existe.' }

  const prev = (marca as Record<string, string | null>)[field] ?? null
  const previousPath = imageStoragePathFromUrl(prev)

  const { error: updateErr } = await admin
    .from('marcas')
    .update({ [field]: null })
    .eq('id', marcaId)

  if (updateErr) {
    return { ok: false, error: `Error al actualizar la marca: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(LOGO_BUCKET).remove([previousPath])
  }

  revalidateMarcas(marcaId)
  return { ok: true, url: null }
}

// Public actions — firmas estables. Isologo idéntico a antes; isotipo nuevo.
export async function uploadMarcaLogo(
  marcaId: string,
  formData: FormData,
): Promise<MarcaImageActionResult> {
  return uploadMarcaImage(marcaId, formData, 'logo_url')
}

export async function removeMarcaLogo(
  marcaId: string,
): Promise<MarcaImageActionResult> {
  return removeMarcaImage(marcaId, 'logo_url')
}

export async function uploadMarcaIso(
  marcaId: string,
  formData: FormData,
): Promise<MarcaImageActionResult> {
  return uploadMarcaImage(marcaId, formData, 'iso_url')
}

export async function removeMarcaIso(
  marcaId: string,
): Promise<MarcaImageActionResult> {
  return removeMarcaImage(marcaId, 'iso_url')
}

// ---------------------------------------------------------------------------
// deleteMarca
// ---------------------------------------------------------------------------

export async function deleteMarca(id: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await admin.from('marcas').delete().eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateMarcas()
  redirect('/admin/marcas')
}
