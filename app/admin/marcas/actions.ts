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
// uploadMarcaLogo / removeMarcaLogo
// ---------------------------------------------------------------------------

const LOGO_BUCKET = 'marca-logos'
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export type LogoActionResult = { ok: true; logoUrl: string | null } | { ok: false; error: string }

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

/** Devuelve el storage_path relativo al bucket si la URL pública apunta al bucket de logos. */
function logoStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function uploadMarcaLogo(
  marcaId: string,
  formData: FormData,
): Promise<LogoActionResult> {
  if (!marcaId) return { ok: false, error: 'Falta el ID de la marca.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Seleccioná un archivo de imagen.' }
  }
  if (!LOGO_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Formato no permitido. Usá PNG, JPG, WebP o SVG.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: 'El archivo supera los 2 MB.' }
  }

  const admin = createAdminClient()

  // Verificar que la marca existe (y traer logo_url anterior para limpieza).
  const { data: marca, error: fetchErr } = await admin
    .from('marcas')
    .select('id, logo_url')
    .eq('id', marcaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la marca: ${fetchErr.message}` }
  if (!marca) return { ok: false, error: 'La marca no existe.' }

  // Path: marca-logos/{marcaId}/{timestamp}-{filename}
  const safeName = sanitizeFilename(file.name)
  const storagePath = `${marcaId}/${Date.now()}-${safeName}`

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
  const logoUrl = publicUrlData.publicUrl

  const { error: updateErr } = await admin
    .from('marcas')
    .update({ logo_url: logoUrl })
    .eq('id', marcaId)

  if (updateErr) {
    // Rollback del archivo si falla el update.
    await admin.storage.from(LOGO_BUCKET).remove([storagePath])
    return { ok: false, error: `Error al actualizar la marca: ${updateErr.message}` }
  }

  // Limpieza del logo anterior (best-effort).
  const previousPath = logoStoragePathFromUrl(marca.logo_url ?? null)
  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(LOGO_BUCKET).remove([previousPath])
  }

  revalidateMarcas(marcaId)
  return { ok: true, logoUrl }
}

export async function removeMarcaLogo(marcaId: string): Promise<LogoActionResult> {
  if (!marcaId) return { ok: false, error: 'Falta el ID de la marca.' }

  const admin = createAdminClient()

  const { data: marca, error: fetchErr } = await admin
    .from('marcas')
    .select('id, logo_url')
    .eq('id', marcaId)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: `Error verificando la marca: ${fetchErr.message}` }
  if (!marca) return { ok: false, error: 'La marca no existe.' }

  const previousPath = logoStoragePathFromUrl(marca.logo_url ?? null)

  const { error: updateErr } = await admin
    .from('marcas')
    .update({ logo_url: null })
    .eq('id', marcaId)

  if (updateErr) {
    return { ok: false, error: `Error al actualizar la marca: ${updateErr.message}` }
  }

  if (previousPath) {
    await admin.storage.from(LOGO_BUCKET).remove([previousPath])
  }

  revalidateMarcas(marcaId)
  return { ok: true, logoUrl: null }
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
