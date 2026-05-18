'use server'

/**
 * app/portal/footer/actions.ts
 *
 * Self-service de las cards del footer para la MARCA logueada.
 * SEGURIDAD POR CONSTRUCCIÓN: la marca sale de la sesión (getMyMarca),
 * nunca del cliente. `marca_id` se fuerza a esa marca; las ops por id
 * verifican que la card sea de la marca.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'

type Result = { error: string | null }

function parseOptionalText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function parseRequiredText(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}
function parseSortOrder(v: FormDataEntryValue | null): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 100
}

function buildPayload(formData: FormData) {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  return {
    sort_order: parseSortOrder(formData.get('sort_order')),
    icon_key: parseRequiredText(formData.get('icon_key')) || 'factory',
    number_text: parseRequiredText(formData.get('number_text')),
    unit_text: parseOptionalText(formData.get('unit_text')),
    label_text: parseRequiredText(formData.get('label_text')),
    status: ['active', 'inactive', 'archived'].includes(status)
      ? status
      : 'active',
  }
}

function validate(p: { number_text: string; label_text: string }): string | null {
  if (!p.number_text) return 'El texto destacado es obligatorio.'
  if (!p.label_text) return 'El label es obligatorio.'
  return null
}

async function callerMarcaId(): Promise<string | null> {
  const server = await createClient()
  const {
    data: { user },
  } = await server.auth.getUser()
  if (!user) return null
  const marca = await getMyMarca(server, user.id)
  return marca?.id ?? null
}

async function assertOwn(
  marcaId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('footer_card_content')
    .select('id, marca_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'La card no existe.' }
  if (row.marca_id !== marcaId)
    return { ok: false, error: 'Esa card no es de tu marca.' }
  return { ok: true }
}

function revalidateMine() {
  revalidatePath('/portal/footer')
}

export async function createMyFooterCard(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const payload = buildPayload(formData)
  const v = validate(payload)
  if (v) return { error: v }

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('footer_card_content')
    .insert({ marca_id: marcaId, ...payload })
    .select('id')
    .single()

  if (error) return { error: `Error al crear: ${error.message}` }

  revalidateMine()
  redirect(`/portal/footer/${inserted.id}`)
}

export async function updateMyFooterCard(
  id: string,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const guard = await assertOwn(marcaId, id)
  if (!guard.ok) return { error: guard.error }

  const payload = buildPayload(formData)
  const v = validate(payload)
  if (v) return { error: v }

  const admin = createAdminClient()
  const { error } = await admin
    .from('footer_card_content')
    .update({ marca_id: marcaId, ...payload })
    .eq('id', id)

  if (error) return { error: `Error al actualizar: ${error.message}` }

  revalidateMine()
  return { error: null }
}

export async function deleteMyFooterCard(id: string): Promise<Result> {
  const marcaId = await callerMarcaId()
  if (!marcaId) return { error: 'No se encontró tu marca.' }

  const guard = await assertOwn(marcaId, id)
  if (!guard.ok) return { error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('footer_card_content')
    .delete()
    .eq('id', id)

  if (error) return { error: `No se pudo eliminar: ${error.message}` }

  revalidateMine()
  redirect('/portal/footer')
}
