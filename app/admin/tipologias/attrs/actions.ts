'use server'

/**
 * app/admin/tipologias/attrs/actions.ts
 *
 * Server Actions para la librería de los 4 ejes nuevos (tipologia_attrs).
 *
 *   eje + valor + marca_id (NULL = compartido) son la identidad.
 *   En modo edit, eje y marca_id quedan locked; valor también (el catálogo
 *   matchea por valor exacto contra house_catalog.{eje}). nombre y
 *   descripcion son los editables.
 *
 * Todas las escrituras usan service-role (bypass RLS).
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidEje, type AttrEje } from '@/lib/supabase/queries/tipologia-attrs'

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

type Payload = {
  marca_id: string | null
  eje: AttrEje
  valor: string
  nombre: string
  descripcion: string | null
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(
  formData: FormData,
  opts: { lockEje?: AttrEje; lockValor?: string; lockMarca?: string | null },
): Payload | { error: string } {
  const ejeRaw = opts.lockEje ?? parseOptionalText(formData.get('eje'))
  if (!isValidEje(ejeRaw)) return { error: 'Eje inválido.' }
  const valor = opts.lockValor ?? parseRequiredText(formData.get('valor'))
  if (!valor) return { error: 'El valor es obligatorio.' }
  if (valor.length > 32) return { error: 'El valor debe tener 32 caracteres o menos.' }

  const statusRaw = parseOptionalText(formData.get('status')) ?? 'active'
  const status = (['active', 'inactive', 'archived'].includes(statusRaw)
    ? statusRaw
    : 'active') as Payload['status']

  return {
    marca_id:
      opts.lockMarca !== undefined
        ? opts.lockMarca
        : parseMarcaId(formData.get('marca_id')),
    eje: ejeRaw,
    valor,
    nombre: parseRequiredText(formData.get('nombre')),
    descripcion: parseOptionalText(formData.get('descripcion')),
    sort_order: parseSortOrder(formData.get('sort_order')),
    status,
  }
}

function validatePayload(p: Payload): string | null {
  if (!p.nombre) return 'El nombre es obligatorio.'
  if (p.nombre.length > 80) return 'El nombre debe tener 80 caracteres o menos.'
  return null
}

function revalidateAttrs(id?: string) {
  revalidatePath('/admin/tipologias')
  revalidatePath('/admin')
  // Catálogo público + ficha consumen las descripciones.
  revalidatePath('/')
  revalidatePath('/catalogo')
  if (id) revalidatePath(`/admin/tipologias/attrs/${id}`)
}

type Result = { error: string | null }

export async function createTipologiaAttr(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const built = buildPayload(formData, {})
  if ('error' in built) return { error: built.error }
  const validation = validatePayload(built)
  if (validation) return { error: validation }

  // Dup check (marca_id, eje, valor)
  let q = admin
    .from('tipologia_attrs')
    .select('id')
    .eq('eje', built.eje)
    .eq('valor', built.valor)
  q = built.marca_id ? q.eq('marca_id', built.marca_id) : q.is('marca_id', null)
  const { data: existing } = await q.maybeSingle()
  if (existing) {
    return {
      error: `Ya existe "${built.valor}" en ${built.eje} (${
        built.marca_id ? 'esa marca' : 'ámbito compartido'
      }).`,
    }
  }

  const { data: inserted, error } = await admin
    .from('tipologia_attrs')
    .insert(built)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un valor con esa combinación (marca, eje, valor).' }
    }
    return { error: `Error al crear: ${error.message}` }
  }
  revalidateAttrs()
  redirect(`/admin/tipologias/attrs/${inserted.id}`)
}

export async function updateTipologiaAttr(
  id: string,
  currentEje: AttrEje,
  currentValor: string,
  currentMarcaId: string | null,
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()
  const built = buildPayload(formData, {
    lockEje: currentEje,
    lockValor: currentValor,
    lockMarca: currentMarcaId,
  })
  if ('error' in built) return { error: built.error }
  const validation = validatePayload(built)
  if (validation) return { error: validation }

  const { error } = await admin.from('tipologia_attrs').update(built).eq('id', id)
  if (error) return { error: `Error al actualizar: ${error.message}` }

  revalidateAttrs(id)
  return { error: null }
}

export async function deleteTipologiaAttr(id: string): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('tipologia_attrs').delete().eq('id', id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidateAttrs()
  redirect('/admin/tipologias')
}
