'use server'

/**
 * app/admin/tipologias/actions.ts
 *
 * Server Actions para la librería de tipologías arquitectónicas.
 *
 *   Ámbito Global (marca_id NULL) → compartido por todas las marcas.
 *   Ámbito Marca  (marca_id = X)   → propietario de esa marca.
 *
 * `code` se setea al crear y NO se edita después (el catálogo matchea
 * house_catalog.tipologia_code_new contra él). `marca_id` tampoco se edita.
 * Mismo patrón que sistema_constructivo_content.
 *
 * Todas las escrituras usan service-role (bypass RLS).
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

function parseMarcaId(value: FormDataEntryValue | null): string | null {
  const s = parseOptionalText(value)
  if (!s || s === 'global') return null
  return s
}

/** Normaliza el code: A-Z y 0-9 sin acentos. Ej "déck" → "DECK". */
function normalizeCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

type TipPayload = {
  marca_id: string | null
  code: string
  nombre: string
  descripcion: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(
  formData: FormData,
  opts: { lockCode?: string; lockMarca?: string | null },
): TipPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'
  const codeRaw = parseRequiredText(formData.get('code'))
  return {
    marca_id:
      opts.lockMarca !== undefined
        ? opts.lockMarca
        : parseMarcaId(formData.get('marca_id')),
    code: opts.lockCode ?? normalizeCode(codeRaw),
    nombre: parseRequiredText(formData.get('nombre')),
    descripcion: parseOptionalText(formData.get('descripcion')),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
  }
}

function validatePayload(p: TipPayload): string | null {
  if (!p.code) return 'El code es obligatorio (ej. EJE, NODO).'
  if (p.code.length > 16) return 'El code debe tener 16 caracteres o menos.'
  if (!p.nombre) return 'El nombre es obligatorio.'
  return null
}

function revalidateTipologias(id?: string) {
  revalidatePath('/admin/tipologias')
  revalidatePath('/admin')
  // El catálogo público consume las tipologías en home + agregador + fichas.
  revalidatePath('/')
  revalidatePath('/catalogo')
  if (id) revalidatePath(`/admin/tipologias/${id}`)
}

type Result = { error: string | null }

// ---------------------------------------------------------------------------
// createTipologia
// ---------------------------------------------------------------------------

export async function createTipologia(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(formData, {})
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  // Unicidad (marca_id, code). marca_id NULL es distinguible.
  let dupQuery = admin
    .from('tipologia_catalog')
    .select('id')
    .eq('code', payload.code)
  dupQuery = payload.marca_id
    ? dupQuery.eq('marca_id', payload.marca_id)
    : dupQuery.is('marca_id', null)
  const { data: existing } = await dupQuery.maybeSingle()

  if (existing) {
    return {
      error: `Ya existe una tipología "${payload.code}" en ${
        payload.marca_id ? 'esa marca' : 'el ámbito compartido'
      }.`,
    }
  }

  const { data: inserted, error } = await admin
    .from('tipologia_catalog')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una tipología con ese code y ámbito.' }
    }
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateTipologias()
  redirect(`/admin/tipologias/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateTipologia
// code y marca_id NO se editan — se pasan por bind desde el page.
// ---------------------------------------------------------------------------

export async function updateTipologia(
  id: string,
  currentCode: string,
  currentMarcaId: string | null,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(formData, {
    lockCode: currentCode,
    lockMarca: currentMarcaId,
  })
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { error } = await admin
    .from('tipologia_catalog')
    .update(payload)
    .eq('id', id)

  if (error) {
    return { error: `Error al actualizar: ${error.message}` }
  }

  revalidateTipologias(id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// deleteTipologia
// Borrar una fila hace que el catálogo caiga al fallback (compartida del mismo
// code o, si no hay, al texto raw de house_catalog.tipologia_code_new).
// ---------------------------------------------------------------------------

export async function deleteTipologia(id: string): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tipologia_catalog')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  revalidateTipologias()
  redirect('/admin/tipologias')
}
