'use server'

/**
 * app/admin/marcas/[id]/zonas/actions.ts
 *
 * Server Actions de las reglas zonales (marca_zonas) de una marca.
 *
 * Convenciones:
 *   - `marca_id` se bindea desde el page (URL); el form no lo manda.
 *   - `provincia_id` es OBLIGATORIO y NO se edita después (parte del UNIQUE
 *     scope). En la edit page se muestra disabled.
 *   - `linea_id` / `sistema_constructivo` también son parte del scope —
 *     disabled en edit. NULL = aplica a todas/os.
 *   - `extra_charge_amount` SOLO en la regla general (sin linea y sin sc);
 *     validamos antes de insertar (el CHECK constraint también lo enforce).
 *
 * Service-role en todas las escrituras.
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

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1'
}

function parseNumericOrNull(value: FormDataEntryValue | null): number | null {
  const s = parseOptionalText(value)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Selectores devuelven 'null' literal como string cuando el user elige "Todas/os". */
function parseNullableId(value: FormDataEntryValue | null): string | null {
  const s = parseOptionalText(value)
  return !s || s === 'null' ? null : s
}

type ZonaPayload = {
  marca_id: string
  provincia_id: string
  linea_id: string | null
  sistema_constructivo: string | null
  excluded: boolean
  price_modifier_pct: number | null
  extra_charge_amount: number | null
  extra_charge_label: string | null
  contact_only: boolean
  promo_label: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'archived'
}

function buildPayload(
  marca_id: string,
  formData: FormData,
  opts: { lockScope?: Pick<ZonaPayload, 'provincia_id' | 'linea_id' | 'sistema_constructivo'> },
): ZonaPayload {
  const status = (parseOptionalText(formData.get('status')) ?? 'active') as
    | 'active'
    | 'inactive'
    | 'archived'

  const provincia_id = opts.lockScope?.provincia_id
    ?? parseRequiredText(formData.get('provincia_id'))
  const linea_id = opts.lockScope?.linea_id !== undefined
    ? opts.lockScope.linea_id
    : parseNullableId(formData.get('linea_id'))
  const sistema_constructivo = opts.lockScope?.sistema_constructivo !== undefined
    ? opts.lockScope.sistema_constructivo
    : parseNullableId(formData.get('sistema_constructivo'))

  return {
    marca_id,
    provincia_id,
    linea_id,
    sistema_constructivo,
    excluded: parseBool(formData.get('excluded')),
    price_modifier_pct: parseNumericOrNull(formData.get('price_modifier_pct')),
    extra_charge_amount: parseNumericOrNull(formData.get('extra_charge_amount')),
    extra_charge_label: parseOptionalText(formData.get('extra_charge_label')),
    contact_only: parseBool(formData.get('contact_only')),
    promo_label: parseOptionalText(formData.get('promo_label')),
    notes: parseOptionalText(formData.get('notes')),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
  }
}

function validatePayload(p: ZonaPayload): string | null {
  if (!p.provincia_id) return 'Tenés que elegir una provincia.'
  // El CHECK constraint también lo enforce; lo verificamos acá para dar un
  // mensaje más amable.
  if (p.extra_charge_amount != null && (p.linea_id !== null || p.sistema_constructivo !== null)) {
    return 'El cargo extra solo se setea en la regla general (sin línea y sin SC). Movelo a la regla general o quitalo.'
  }
  return null
}

function revalidateZonas(marca_id: string, zonaId?: string) {
  revalidatePath(`/admin/marcas/${marca_id}/zonas`)
  revalidatePath(`/admin/marcas/${marca_id}`)
  revalidatePath('/admin')
  // El catálogo público lee las zonas activas al renderizar.
  revalidatePath('/')
  revalidatePath('/catalogo')
  if (zonaId) revalidatePath(`/admin/marcas/${marca_id}/zonas/${zonaId}`)
}

type Result = { error: string | null }

// ---------------------------------------------------------------------------
// createMarcaZona
// ---------------------------------------------------------------------------

export async function createMarcaZona(
  marca_id: string,
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(marca_id, formData, {})
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { data: inserted, error } = await admin
    .from('marca_zonas')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Ya existe una regla con ese scope (marca + provincia + línea + SC). Editá la existente.',
      }
    }
    if (error.code === '23514') {
      return {
        error:
          'El cargo extra solo se permite en la regla general (sin línea y sin SC).',
      }
    }
    return { error: `Error al crear: ${error.message}` }
  }

  revalidateZonas(marca_id)
  redirect(`/admin/marcas/${marca_id}/zonas/${inserted.id}`)
}

// ---------------------------------------------------------------------------
// updateMarcaZona
// Scope (provincia/linea/sc) NO se edita — se bindea desde el page.
// ---------------------------------------------------------------------------

export async function updateMarcaZona(
  marca_id: string,
  id: string,
  scope: { provincia_id: string; linea_id: string | null; sistema_constructivo: string | null },
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const payload = buildPayload(marca_id, formData, { lockScope: scope })
  const validation = validatePayload(payload)
  if (validation) return { error: validation }

  const { error } = await admin
    .from('marca_zonas')
    .update(payload)
    .eq('id', id)

  if (error) {
    if (error.code === '23514') {
      return {
        error:
          'El cargo extra solo se permite en la regla general (sin línea y sin SC).',
      }
    }
    return { error: `Error al actualizar: ${error.message}` }
  }

  revalidateZonas(marca_id, id)
  return { error: null }
}

// ---------------------------------------------------------------------------
// deleteMarcaZona
// ---------------------------------------------------------------------------

export async function deleteMarcaZona(
  marca_id: string,
  id: string,
): Promise<Result> {
  const admin = createAdminClient()
  const { error } = await admin.from('marca_zonas').delete().eq('id', id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidateZonas(marca_id)
  redirect(`/admin/marcas/${marca_id}/zonas`)
}
