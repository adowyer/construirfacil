/**
 * lib/supabase/queries/house_images.ts
 *
 * Consulta de imágenes desde el nuevo schema (model_images) con fallback
 * automático por especificidad (línea > tipología > estilo > variante > sistema).
 *
 * IMPORTANTE: mantiene la misma SHAPE de retorno que el código viejo:
 *   { [variant_code]: HouseImage[] }
 *
 * Por dentro consulta la vista `house_images_resolved` que ya hace el matching
 * y luego ordena las imágenes por specificity (más específicas primero).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HouseImage = {
  id: string
  variant_code: string         // = sku
  storage_path: string
  alt_text: string | null
  order_idx: number
  lqip_color: string | null

  // Campos nuevos disponibles
  is_exterior?: boolean
  room_type?: string | null
}

/**
 * Devuelve un mapa { [sku]: HouseImage[] } con las fotos resolved para cada SKU,
 * ordenadas por:
 *   1. specificity desc (4 = matchea todos los campos, 0 = genérica)
 *   2. is_exterior desc (exteriores primero — son las más representativas)
 *   3. sort_order asc
 */
export async function getHouseImagesByVariantCodes(
  supabase: SupabaseClient,
  variantCodes: string[]
): Promise<Record<string, HouseImage[]>> {
  if (variantCodes.length === 0) return {}

  // La vista house_images_resolved hace el matching con fallback automático
  const { data, error } = await supabase
    .from('house_images_resolved')
    .select('sku, image_id, is_exterior, room_type, storage_url, lqip_color, sort_order, specificity, width, height')
    .in('sku', variantCodes)
    .order('specificity', { ascending: false })
    .order('is_exterior', { ascending: false })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getHouseImagesByVariantCodes]', error.message)
    return {}
  }

  // La vista no expone thumb_url/webp_url. Hacemos un join post-fetch a
  // model_images para que los consumidores reciban URLs optimizadas
  // (ahorra egress; el original queda como fallback).
  const imageIds = [
    ...new Set((data ?? []).map((r: any) => r.image_id).filter(Boolean)),
  ]
  const optimizedById = new Map<string, { webp_url: string | null }>()
  if (imageIds.length > 0) {
    const { data: optRows } = await supabase
      .from('model_images')
      .select('id, webp_url')
      .in('id', imageIds)
    for (const r of (optRows ?? []) as { id: string; webp_url: string | null }[]) {
      optimizedById.set(r.id, { webp_url: r.webp_url })
    }
  }

  const grouped: Record<string, HouseImage[]> = {}
  for (const img of data ?? []) {
    const key = (img as any).sku
    if (!grouped[key]) grouped[key] = []

    const opt = optimizedById.get((img as any).image_id)
    const url = opt?.webp_url ?? (img as any).storage_url

    grouped[key].push({
      id: (img as any).image_id,
      variant_code: key,
      storage_path: url,   // URL pública (webp_url si está, sino original)
      alt_text: null,
      order_idx: (img as any).sort_order ?? 0,
      lqip_color: (img as any).lqip_color ?? null,
      is_exterior: (img as any).is_exterior,
      room_type: (img as any).room_type,
    })
  }
  return grouped
}

/**
 * En el schema viejo, storage_path era un path relativo y necesitaba
 * convertirse a URL pública. En el schema nuevo, la vista ya devuelve
 * URLs completas. Por compatibilidad, esta función ahora es identidad
 * cuando recibe una URL absoluta y construye la URL si recibe un path.
 */
export function buildStorageUrl(
  supabase: SupabaseClient,
  storagePathOrUrl: string
): string {
  if (!storagePathOrUrl) return ''
  // Ya es URL absoluta
  if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
    return storagePathOrUrl
  }
  // Es un path relativo: construir URL pública
  const { data } = supabase.storage.from('house-photos').getPublicUrl(storagePathOrUrl)
  return data.publicUrl
}
