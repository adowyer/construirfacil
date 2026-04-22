/**
 * lib/supabase/queries/attributes.ts
 *
 * Named query functions for attribute_types, attribute_values,
 * and construction_systems.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AttributeType,
  AttributeTypeWithValues,
  AttributeValue,
  ConstructionSystem,
} from '@/types/database'

// ---------------------------------------------------------------------------
// construction_systems — public read
// ---------------------------------------------------------------------------

/**
 * Fetch all construction systems ordered by sort_order.
 * Used in: catalog filter bar, house model form dropdown.
 */
export async function getConstructionSystems(
  supabase: SupabaseClient,
): Promise<ConstructionSystem[]> {
  const { data, error } = await supabase
    .from('construction_systems')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getConstructionSystems]', error.message)
    return []
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// attribute_types — public read
// ---------------------------------------------------------------------------

/**
 * Fetch all attribute types with their values.
 * Used in: house model form (AttributeSelector), admin panel.
 */
export async function getAttributeTypesWithValues(
  supabase: SupabaseClient,
): Promise<AttributeTypeWithValues[]> {
  const { data, error } = await supabase
    .from('attribute_types')
    .select(
      `
      *,
      attribute_values(* order sort_order.asc)
    `,
    )
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAttributeTypesWithValues]', error.message)
    return []
  }

  return data as unknown as AttributeTypeWithValues[]
}

/**
 * Fetch a single attribute type with its values by ID.
 * Used in: admin attribute edit page.
 */
export async function getAttributeTypeById(
  supabase: SupabaseClient,
  id: string,
): Promise<AttributeTypeWithValues | null> {
  const { data, error } = await supabase
    .from('attribute_types')
    .select(
      `
      *,
      attribute_values(* order sort_order.asc)
    `,
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data as unknown as AttributeTypeWithValues
}

/**
 * Fetch all attribute types (no values — lighter, for listing).
 */
export async function getAttributeTypes(
  supabase: SupabaseClient,
): Promise<AttributeType[]> {
  const { data, error } = await supabase
    .from('attribute_types')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAttributeTypes]', error.message)
    return []
  }

  return data ?? []
}

/**
 * Fetch values for a specific attribute type.
 */
export async function getAttributeValuesByType(
  supabase: SupabaseClient,
  attributeTypeId: string,
): Promise<AttributeValue[]> {
  const { data, error } = await supabase
    .from('attribute_values')
    .select('*')
    .eq('attribute_type_id', attributeTypeId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAttributeValuesByType]', error.message)
    return []
  }

  return data ?? []
}
