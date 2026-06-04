'use server'

/**
 * app/admin/promos/actions.ts
 *
 * Server Actions para CRUD sobre `promo_messages` (banners del catálogo).
 * Usa service-role admin client (bypass RLS). El founder los edita desde
 * /admin/promos. El catálogo público los renderiza con CatalogPromoBanner.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: boolean; error: string | null }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function reqText(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

function optInt(v: FormDataEntryValue | null, fallback: number): number {
  if (v === null) return fallback
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? Math.round(n) : fallback
}

const COLORS = new Set(['red', 'cyan', 'yellow', 'green'])
const SCOPES = new Set(['hero', 'intermediate'])
const CTA_ACTIONS = new Set(['none', 'contactar', 'ximia', 'saber_mas'])

function sanitize(formData: FormData) {
  const marca_id = optText(formData.get('marca_id'))
  if (!marca_id) throw new Error('Marca requerida')

  const titulo = reqText(formData.get('titulo'))
  const cuerpo = reqText(formData.get('cuerpo'))
  if (!titulo) throw new Error('Título (eyebrow) requerido')
  if (!cuerpo) throw new Error('Cuerpo (copy) requerido')

  const rawColor = optText(formData.get('color')) ?? 'green'
  const rawScope = optText(formData.get('scope')) ?? 'intermediate'
  const rawAction = optText(formData.get('cta_action')) ?? 'none'

  const color = COLORS.has(rawColor) ? rawColor : 'green'
  const scope = SCOPES.has(rawScope) ? rawScope : 'intermediate'
  const cta_action = CTA_ACTIONS.has(rawAction) ? rawAction : 'none'

  // CTA label solo tiene sentido si la acción no es 'none'. Si es 'none',
  // forzamos null aunque el form lo manide algo.
  const cta_label = cta_action === 'none' ? null : optText(formData.get('cta_label'))

  return {
    marca_id,
    provincia_id: optText(formData.get('provincia_id')),
    scope,
    titulo,
    cuerpo,
    color,
    cta_label,
    cta_action,
    activo: formData.get('activo') === 'on',
    sort_order: optInt(formData.get('sort_order'), 100),
    starts_at: optText(formData.get('starts_at')),
    ends_at: optText(formData.get('ends_at')),
  }
}

export async function createPromo(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let payload
  try {
    payload = sanitize(formData)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('promo_messages').insert(payload)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promos')
  revalidatePath('/catalogo')
  revalidatePath('/')
  redirect('/admin/promos')
}

export async function updatePromo(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let payload
  try {
    payload = sanitize(formData)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('promo_messages')
    .update(payload)
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promos')
  revalidatePath('/catalogo')
  revalidatePath('/')
  redirect('/admin/promos')
}

export async function deletePromo(id: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('promo_messages').delete().eq('id', id)
  revalidatePath('/admin/promos')
  revalidatePath('/catalogo')
  revalidatePath('/')
}

export async function toggleActivo(id: string, next: boolean): Promise<void> {
  const admin = createAdminClient()
  await admin.from('promo_messages').update({ activo: next }).eq('id', id)
  revalidatePath('/admin/promos')
  revalidatePath('/catalogo')
  revalidatePath('/')
}
