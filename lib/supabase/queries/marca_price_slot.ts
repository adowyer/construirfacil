/**
 * lib/supabase/queries/marca_price_slot.ts
 *
 * Semántica de precios por marca (schema: 0041_marca_price_slot.sql). Las 3
 * columnas de house_catalog (lista/contado/pozo) son slots genéricos; esta
 * tabla les da nombre (label libre del proveedor) y marca cuál es el BASE
 * (el precio sugerido sobre el que el cotizador aplica los deltas).
 *
 * DISPLAY data, lectura pública (anon). Resiliente: error → [] (el catálogo
 * degrada al default 'lista' como base, no rompe).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Slot físico → columna de precio en house_catalog. Única fuente de verdad. */
export const PRICE_SLOT_COLUMN = {
  lista: 'precio_lista_usd',
  contado: 'precio_contado_usd',
  pozo: 'precio_pozo_usd',
} as const

export type PriceSlotKey = keyof typeof PRICE_SLOT_COLUMN

export const PRICE_SLOT_KEYS = Object.keys(PRICE_SLOT_COLUMN) as PriceSlotKey[]

export interface MarcaPriceSlot {
  id: string
  marca_id: string
  slot_key: PriceSlotKey
  label: string
  is_base: boolean
  enabled: boolean
  sort_order: number
}

/** Slots de una marca, ordenados. enabled-only por defecto (display). */
export async function getMarcaPriceSlots(
  client: SupabaseClient,
  marcaId: string,
  opts: { includeDisabled?: boolean } = {},
): Promise<MarcaPriceSlot[]> {
  let q = client
    .from('marca_price_slot')
    .select('*')
    .eq('marca_id', marcaId)
    .order('sort_order', { ascending: true })
  if (!opts.includeDisabled) q = q.eq('enabled', true)
  const { data, error } = await q
  if (error) {
    console.error('[getMarcaPriceSlots]', error.message)
    return []
  }
  return (data ?? []) as MarcaPriceSlot[]
}

/**
 * Slot base de una marca → de qué columna de house_catalog sale el precio
 * "sugerido" que consume el cotizador. Degrada a 'lista' si la marca no
 * configuró slots todavía (o ante error): nunca rompe el cotizador.
 */
export async function getBasePriceSlot(
  client: SupabaseClient,
  marcaId: string,
): Promise<{ slot: PriceSlotKey; column: string; label: string }> {
  const fallback = {
    slot: 'lista' as PriceSlotKey,
    column: PRICE_SLOT_COLUMN.lista,
    label: 'Lista',
  }
  const { data, error } = await client
    .from('marca_price_slot')
    .select('slot_key, label')
    .eq('marca_id', marcaId)
    .eq('is_base', true)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getBasePriceSlot]', error.message)
    return fallback
  }
  const slot = data.slot_key as PriceSlotKey
  return { slot, column: PRICE_SLOT_COLUMN[slot] ?? fallback.column, label: data.label }
}
