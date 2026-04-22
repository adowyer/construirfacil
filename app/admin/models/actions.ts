'use server'

/**
 * app/admin/models/actions.ts
 *
 * Server Actions for house_catalog CRUD operations.
 * All writes use the service-role admin client to bypass RLS.
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

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null || value === '') return null
  return String(value).trim()
}

// ---------------------------------------------------------------------------
// createModel
// ---------------------------------------------------------------------------

export async function createModel(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const variant_code = String(formData.get('variant_code') ?? '').trim()

  // Check uniqueness before insert
  const { data: existing } = await admin
    .from('house_catalog')
    .select('id')
    .eq('variant_code', variant_code)
    .maybeSingle()

  if (existing) {
    return { error: `El código de variante "${variant_code}" ya existe. Elegí un código único.` }
  }

  const payload = {
    model_id: String(formData.get('model_id') ?? '').trim(),
    variant_code,
    name: String(formData.get('name') ?? '').trim(),
    variant_style: parseOptionalText(formData.get('variant_style')),
    area_m2: parseOptionalNumber(formData.get('area_m2')),
    floors: parseOptionalNumber(formData.get('floors')),
    min_bedrooms: parseOptionalNumber(formData.get('min_bedrooms')),
    max_bedrooms: parseOptionalNumber(formData.get('max_bedrooms')),
    recommended_family_size_min: parseOptionalNumber(
      formData.get('recommended_family_size_min'),
    ),
    recommended_family_size_max: parseOptionalNumber(
      formData.get('recommended_family_size_max'),
    ),
    recommended_use: parseOptionalText(formData.get('recommended_use')),
    construction_cost_usd: parseOptionalNumber(formData.get('construction_cost_usd')),
    public_price_usd: parseOptionalNumber(formData.get('public_price_usd')),
    construction_system: String(
      formData.get('construction_system') ?? 'HAUSIND',
    ).trim(),
    brochure_url: parseOptionalText(formData.get('brochure_url')),
    status: String(formData.get('status') ?? 'active'),
    construction_cost_pct: parseOptionalNumber(formData.get('construction_cost_pct')),
    presale_discount_pct: parseOptionalNumber(formData.get('presale_discount_pct')),
  }

  const { error } = await admin.from('house_catalog').insert(payload)

  if (error) {
    // Postgres unique constraint gives code 23505
    if (error.code === '23505') {
      return {
        error: `El código de variante "${variant_code}" ya existe. Elegí un código único.`,
      }
    }
    return { error: `Error al crear el modelo: ${error.message}` }
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

  const variant_code = String(formData.get('variant_code') ?? '').trim()

  // Check uniqueness — exclude the current row
  const { data: existing } = await admin
    .from('house_catalog')
    .select('id')
    .eq('variant_code', variant_code)
    .neq('id', id)
    .maybeSingle()

  if (existing) {
    return {
      error: `El código de variante "${variant_code}" ya está en uso por otro modelo.`,
    }
  }

  const payload = {
    model_id: String(formData.get('model_id') ?? '').trim(),
    variant_code,
    name: String(formData.get('name') ?? '').trim(),
    variant_style: parseOptionalText(formData.get('variant_style')),
    area_m2: parseOptionalNumber(formData.get('area_m2')),
    floors: parseOptionalNumber(formData.get('floors')),
    min_bedrooms: parseOptionalNumber(formData.get('min_bedrooms')),
    max_bedrooms: parseOptionalNumber(formData.get('max_bedrooms')),
    recommended_family_size_min: parseOptionalNumber(
      formData.get('recommended_family_size_min'),
    ),
    recommended_family_size_max: parseOptionalNumber(
      formData.get('recommended_family_size_max'),
    ),
    recommended_use: parseOptionalText(formData.get('recommended_use')),
    construction_cost_usd: parseOptionalNumber(formData.get('construction_cost_usd')),
    public_price_usd: parseOptionalNumber(formData.get('public_price_usd')),
    construction_system: String(
      formData.get('construction_system') ?? 'HAUSIND',
    ).trim(),
    brochure_url: parseOptionalText(formData.get('brochure_url')),
    status: String(formData.get('status') ?? 'active'),
    construction_cost_pct: parseOptionalNumber(formData.get('construction_cost_pct')),
    presale_discount_pct: parseOptionalNumber(formData.get('presale_discount_pct')),
  }

  const { error } = await admin
    .from('house_catalog')
    .update(payload)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return {
        error: `El código de variante "${variant_code}" ya está en uso por otro modelo.`,
      }
    }
    return { error: `Error al actualizar el modelo: ${error.message}` }
  }

  revalidatePath('/admin/models')
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
