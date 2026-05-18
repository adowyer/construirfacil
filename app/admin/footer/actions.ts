'use server'

/**
 * app/admin/footer/actions.ts
 *
 * Server Actions para CRUD de `footer_card_content` desde el panel admin.
 * Cada marca tiene N cards (típicamente 4: Garantía / 100% Financiado /
 * Fábrica / 50.000 m²). El catálogo público las lee si existen, sino usa
 * el fallback hardcoded.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

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
  return Number.isFinite(n) ? Math.trunc(n) : 100
}

type FooterCardPayload = {
  marca_id: string
  sort_order: number
  icon_key: string
  number_text: string
  unit_text: string | null
  label_text: string
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(formData: FormData): FooterCardPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  return {
    marca_id: parseRequiredText(formData.get('marca_id')),
    sort_order: parseSortOrder(formData.get('sort_order')),
    icon_key: parseRequiredText(formData.get('icon_key')) || 'factory',
    number_text: parseRequiredText(formData.get('number_text')),
    unit_text: parseOptionalText(formData.get('unit_text')),
    label_text: parseRequiredText(formData.get('label_text')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
  }
}

function validatePayload(p: FooterCardPayload): string | null {
  if (!p.marca_id) return 'La marca es obligatoria.'
  if (!p.number_text) return 'El texto destacado es obligatorio.'
  if (!p.label_text) return 'El label es obligatorio.'
  return null
}

function revalidateFooter(id?: string) {
  revalidatePath('/admin/footer')
  revalidatePath('/admin')
  // Catálogo público lee footer cards.
  revalidatePath('/')
  if (id) revalidatePath(`/admin/footer/${id}`)
}

type Result = { error: string | null }

export async function createFooterCard(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { data: inserted, error } = await admin
    .from('footer_card_content')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateFooter()
  redirect(`/admin/footer/${inserted.id}`)
}

export async function updateFooterCard(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const payload = buildPayload(formData)
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { error } = await admin
    .from('footer_card_content')
    .update(payload)
    .eq('id', id)

  if (error) {
    return { error: `Error al actualizar: ${error.message}` }
  }

  revalidateFooter(id)
  return { error: null }
}

export async function deleteFooterCard(id: string): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('footer_card_content').delete().eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateFooter()
  redirect('/admin/footer')
}

// ---------------------------------------------------------------------------
// footer_content — cierre + institucional (singleton CF, key='cf').
// Campos vacíos → NULL → CatalogFooter cae al hardcoded.
// ---------------------------------------------------------------------------

export async function upsertFooterContent(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = {
    eyebrow: parseOptionalText(formData.get('eyebrow')),
    title: parseOptionalText(formData.get('title')),
    cta_primary_label: parseOptionalText(formData.get('cta_primary_label')),
    cta_secondary_label: parseOptionalText(formData.get('cta_secondary_label')),
    copyright_text: parseOptionalText(formData.get('copyright_text')),
    privacy_label: parseOptionalText(formData.get('privacy_label')),
    privacy_url: parseOptionalText(formData.get('privacy_url')),
    terms_label: parseOptionalText(formData.get('terms_label')),
    terms_url: parseOptionalText(formData.get('terms_url')),
  }

  const { data: existing } = await admin
    .from('footer_content')
    .select('id')
    .eq('key', 'cf')
    .maybeSingle()

  const { error } = existing
    ? await admin
        .from('footer_content')
        .update(payload)
        .eq('id', existing.id)
    : await admin
        .from('footer_content')
        .insert({ key: 'cf', ...payload })

  if (error) return { error: `Error al guardar: ${error.message}` }

  revalidateFooter()
  return { error: null }
}
