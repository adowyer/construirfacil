'use server'

/**
 * app/admin/brand/actions.ts
 *
 * Server Actions para CRUD de `brand_content` desde el panel admin.
 * Consumido por el catálogo público (HeroSlider, sliders educativos).
 *
 * Convención: `key` es UNIQUE y NO se edita después de creado (sería
 * romper referencias del público que filtra por key). Solo se setea al
 * crear; el form de edición lo muestra disabled.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

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

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

type BrandContentPayload = {
  key: string
  label: string
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(formData: FormData, opts: { lockKey?: string }): BrandContentPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  return {
    key: opts.lockKey ?? normalizeKey(parseRequiredText(formData.get('key'))),
    label: parseRequiredText(formData.get('label')),
    title: parseOptionalText(formData.get('title')),
    subtitle: parseOptionalText(formData.get('subtitle')),
    body: parseOptionalText(formData.get('body')),
    cta_label: parseOptionalText(formData.get('cta_label')),
    cta_url: parseOptionalText(formData.get('cta_url')),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
  }
}

function validatePayload(p: BrandContentPayload): string | null {
  if (!p.key) return 'La key es obligatoria.'
  if (!p.label) return 'El label es obligatorio.'
  return null
}

function revalidateBrand(id?: string) {
  revalidatePath('/admin/brand')
  revalidatePath('/admin')
  // Catálogo público lee brand_content para los sliders educativos.
  revalidatePath('/')
  revalidatePath('/catalog')
  if (id) revalidatePath(`/admin/brand/${id}`)
}

type Result = { error: string | null }

// ---------------------------------------------------------------------------
// createBrandContent
// ---------------------------------------------------------------------------

export async function createBrandContent(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(formData, {})
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Key únicidad
  const { data: existing } = await admin
    .from('brand_content')
    .select('id')
    .eq('key', payload.key)
    .maybeSingle()

  if (existing) {
    return { error: `Ya existe un brand_content con key "${payload.key}".` }
  }

  const { data: inserted, error } = await admin
    .from('brand_content')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe un brand_content con key "${payload.key}".` }
    }
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateBrand()
  redirect(`/admin/brand/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateBrandContent
// ---------------------------------------------------------------------------

export async function updateBrandContent(
  id: string,
  currentKey: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  // La key NO se edita en update — usamos la actual sin importar lo que mande el form.
  const payload = buildPayload(formData, { lockKey: currentKey })
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { error } = await admin
    .from('brand_content')
    .update(payload)
    .eq('id', id)

  if (error) {
    return { error: `Error al actualizar: ${error.message}` }
  }

  revalidateBrand(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// deleteBrandContent
// ---------------------------------------------------------------------------

export async function deleteBrandContent(id: string): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('brand_content').delete().eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateBrand()
  redirect('/admin/brand')
}
