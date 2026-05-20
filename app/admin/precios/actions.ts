'use server'

/**
 * app/admin/precios/actions.ts
 *
 * Pipeline de import de precios por marca (task #31) + editor de la semántica
 * de precios (marca_price_slot). Writes = service-role. El import nunca nulea
 * columnas que el CSV omite; los duplicados de clave NO se aplican.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parsePriceCsv,
  buildImportPlan,
  applyImportPlan,
  CSV_HEADER,
  type ImportPlan,
  type ApplyResult,
} from '@/lib/pricing/price-import'
import {
  PRICE_SLOT_COLUMN,
  PRICE_SLOT_KEYS,
  type PriceSlotKey,
} from '@/lib/supabase/queries/marca_price_slot'

// ── Import de precios ────────────────────────────────────────────────────────

export type ImportState = {
  error: string | null
  plan?: ImportPlan
  applied?: ApplyResult
}

export async function previewOrImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const marcaId = String(formData.get('marca_id') ?? '').trim()
  const csv = String(formData.get('csv') ?? '')
  const confirm = String(formData.get('confirm') ?? '') === '1'

  if (!marcaId) return { error: 'Elegí una marca.' }
  if (csv.trim() === '') return { error: 'Pegá el CSV de precios.' }

  const parsed = parsePriceCsv(csv)
  if (parsed.error) return { error: parsed.error }

  const admin = createAdminClient()
  let plan: ImportPlan
  try {
    plan = await buildImportPlan(admin, marcaId, parsed)
  } catch (e) {
    return { error: `No se pudo armar el plan: ${(e as Error).message}` }
  }

  if (!confirm) return { error: null, plan }

  if (plan.updates.length === 0) {
    return { error: 'No hay cambios para aplicar.', plan }
  }
  const applied = await applyImportPlan(admin, plan)

  revalidatePath('/admin/precios')
  revalidatePath('/')
  revalidatePath('/empresas')
  revalidatePath('/catalogo')
  return { error: null, plan, applied }
}

/** Descarga: precios actuales de la marca como CSV (plantilla de arranque). */
export async function exportCurrentPricesCsv(
  marcaId: string,
): Promise<{ csv: string | null; error: string | null }> {
  if (!marcaId) return { csv: null, error: 'Falta la marca.' }
  const admin = createAdminClient()
  const sel =
    'linea, style_name, tipologia_code, variante, sistema_constructivo, precio_lista_usd, precio_contado_usd, precio_pozo_usd'
  const rows: Record<string, unknown>[] = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('house_catalog')
      .select(sel)
      .eq('marca_id', marcaId)
      .order('linea')
      .order('style_name')
      .order('tipologia_code')
      .order('variante')
      .order('sistema_constructivo')
      .range(from, from + PAGE - 1)
    if (error) return { csv: null, error: error.message }
    if (!data || data.length === 0) break
    rows.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [CSV_HEADER.join(',')]
  for (const r of rows) lines.push(CSV_HEADER.map((c) => esc(r[c])).join(','))
  // BOM para que Excel respete UTF-8 (acentos: INGÁ, LANÍN…).
  return { csv: '﻿' + lines.join('\r\n'), error: null }
}

// ── Editor de slots (nombres + base + habilitado) ────────────────────────────

export type SlotsState = { error: string | null; ok?: boolean }

export async function saveMarcaSlots(
  _prev: SlotsState,
  formData: FormData,
): Promise<SlotsState> {
  const marcaId = String(formData.get('marca_id') ?? '').trim()
  if (!marcaId) return { error: 'Elegí una marca.' }

  const baseSlot = String(formData.get('base_slot') ?? '').trim()
  if (!PRICE_SLOT_KEYS.includes(baseSlot as PriceSlotKey)) {
    return { error: 'Elegí cuál precio es el base.' }
  }

  const admin = createAdminClient()

  // Upsert de los 3 slots. is_base se setea en dos pasos para no chocar con
  // el índice único parcial (un base por marca): primero todo false, después
  // el elegido true.
  const rows = PRICE_SLOT_KEYS.map((slot, i) => {
    const label = String(formData.get(`label__${slot}`) ?? '').trim()
    const enabled = formData.get(`enabled__${slot}`) === 'on'
    return {
      marca_id: marcaId,
      slot_key: slot,
      label: label || PRICE_SLOT_COLUMN[slot],
      enabled,
      is_base: false,
      sort_order: i + 1,
    }
  })

  const { error: upErr } = await admin
    .from('marca_price_slot')
    .upsert(rows, { onConflict: 'marca_id,slot_key' })
  if (upErr) return { error: `Error al guardar: ${upErr.message}` }

  const { error: baseErr } = await admin
    .from('marca_price_slot')
    .update({ is_base: true })
    .eq('marca_id', marcaId)
    .eq('slot_key', baseSlot)
  if (baseErr) return { error: `Error al fijar el base: ${baseErr.message}` }

  revalidatePath('/admin/precios')
  revalidatePath('/')
  revalidatePath('/empresas')
  revalidatePath('/catalogo')
  return { error: null, ok: true }
}
