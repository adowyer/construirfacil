// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/queries/house-images.ts
// Add this file to your queries directory
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

export type HouseImage = {
  id: string
  variant_code: string
  storage_path: string
  alt_text: string | null
  order_idx: number
  lqip_color: string | null
}

/**
 * Fetch all house images for the given variant_codes,
 * grouped by variant_code and ordered by order_idx.
 *
 * Returns a map: { [variant_code]: HouseImage[] }
 */
export async function getHouseImagesByVariantCodes(
  supabase: SupabaseClient,
  variantCodes: string[]
): Promise<Record<string, HouseImage[]>> {
  if (variantCodes.length === 0) return {}

  const { data, error } = await supabase
    .from('house_images')
    .select('id, variant_code, storage_path, alt_text, order_idx, lqip_color')
    .in('variant_code', variantCodes)
    .order('order_idx', { ascending: true })

  if (error) {
    console.error('[getHouseImagesByVariantCodes]', error)
    return {}
  }

  const grouped: Record<string, HouseImage[]> = {}
  for (const img of data ?? []) {
    if (!grouped[img.variant_code]) grouped[img.variant_code] = []
    grouped[img.variant_code].push(img)
  }
  return grouped
}

/**
 * Build the public URL for a storage path inside the house-photos bucket.
 * Uses Supabase's getPublicUrl — the bucket must be configured as public.
 */
export function buildStorageUrl(
  supabase: SupabaseClient,
  storagePath: string
): string {
  const { data } = supabase.storage.from('house-photos').getPublicUrl(storagePath)
  return data.publicUrl
}
