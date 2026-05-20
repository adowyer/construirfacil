/**
 * lib/pricing/price-import.ts
 *
 * Núcleo del pipeline de import de precios por marca (task #31). Permanente:
 * así actualizamos precios nosotros y cualquier cliente su propia DB.
 *
 * - Una marca por import. Matchea filas del CSV contra house_catalog por la
 *   clave compuesta (linea · style_name · tipologia_code · variante ·
 *   sistema_constructivo), scopeada por marca_id.
 * - Sólo escribe las columnas de precio PRESENTES en el CSV. Nunca nulea una
 *   columna que el archivo omite, ni una celda en blanco.
 * - Dry-run first: buildImportPlan no escribe; applyImportPlan sí (un solo
 *   código de verdad, usado por el Server Action y por scripts → mismo
 *   comportamiento, sin divergencias).
 *
 * El motor Uber consume el slot BASE de la marca (ver marca_price_slot); este
 * pipeline llena las 3 columnas de house_catalog que ese slot referencia.
 */

import { parse } from 'csv-parse/sync'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PRICE_SLOT_COLUMN,
  PRICE_SLOT_KEYS,
  type PriceSlotKey,
} from '@/lib/supabase/queries/marca_price_slot'

// ─────────────────────────────────────────────────────────────────────────────
// Schema del CSV
// ─────────────────────────────────────────────────────────────────────────────

/** Columnas que forman la clave de match (todas obligatorias). */
export const KEY_COLUMNS = [
  'linea',
  'style_name',
  'tipologia_code',
  'variante',
  'sistema_constructivo',
] as const
type KeyColumn = (typeof KEY_COLUMNS)[number]

/** Header canónico esperado (clave + las 3 columnas de precio opcionales). */
export const CSV_HEADER = [
  ...KEY_COLUMNS,
  ...PRICE_SLOT_KEYS.map((k) => PRICE_SLOT_COLUMN[k]),
] as const

/** Normaliza un valor de la clave para comparar (NFC, sin doble espacio,
 *  case-insensitive). NO saca acentos: 'INGÁ' ≠ 'INGA' a propósito. */
export function normKey(v: unknown): string {
  return String(v ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function compositeKey(r: Record<KeyColumn, unknown>): string {
  return KEY_COLUMNS.map((c) => normKey(r[c])).join('')
}

/**
 * Parser de número tolerante: acepta "238769", "238.769,00" (es-AR) y
 * "238769.00". Vacío/ausente → undefined (= no tocar esa columna).
 * Inválido o negativo → null (= error de fila).
 */
export function parsePrice(raw: unknown): number | undefined | null {
  if (raw == null) return undefined
  let s = String(raw).trim()
  if (s === '') return undefined
  s = s.replace(/\s/g, '').replace(/[$]/g, '')
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // El último separador es el decimal; el otro es de miles.
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del plan
// ─────────────────────────────────────────────────────────────────────────────

type PriceSet = Partial<Record<PriceSlotKey, number>>

export interface PlannedUpdate {
  id: string
  label: string // "BOSQUE · LAPACHO · t1 · v1 · STEEL PLUS" (para el preview)
  before: PriceSet
  set: PriceSet // sólo columnas que cambian
}

export interface ImportPlan {
  marcaId: string
  priceColumnsPresent: PriceSlotKey[] // qué precios trae este CSV
  updates: PlannedUpdate[] // filas matcheadas CON cambios
  unchanged: number // matcheadas sin diferencias
  unmatched: string[] // claves del CSV sin SKU en la DB
  invalid: { line: number; reason: string }[] // filas con datos inválidos
  duplicates: string[] // claves repetidas dentro del CSV (ambiguas → no se tocan)
  dbRowsTotal: number // SKUs de la marca en la DB
  dbRowsNotInCsv: number // SKUs que el CSV no menciona (NO se nulean)
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseo del CSV
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  rows: Record<string, string>[]
  priceColumnsPresent: PriceSlotKey[]
  error: string | null
}

export function parsePriceCsv(text: string): ParsedCsv {
  let records: Record<string, string>[]
  try {
    records = parse(text, {
      columns: (header: string[]) =>
        header.map((h) => h.normalize('NFC').trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch (e) {
    return {
      rows: [],
      priceColumnsPresent: [],
      error: `No se pudo leer el CSV: ${(e as Error).message}`,
    }
  }
  if (records.length === 0) {
    return { rows: [], priceColumnsPresent: [], error: 'El CSV está vacío.' }
  }

  const headerSet = new Set(Object.keys(records[0]))
  const missingKey = KEY_COLUMNS.filter((c) => !headerSet.has(c))
  if (missingKey.length > 0) {
    return {
      rows: [],
      priceColumnsPresent: [],
      error: `Faltan columnas obligatorias: ${missingKey.join(', ')}. Header esperado: ${CSV_HEADER.join(', ')}`,
    }
  }

  const priceColumnsPresent = PRICE_SLOT_KEYS.filter((k) =>
    headerSet.has(PRICE_SLOT_COLUMN[k]),
  )
  if (priceColumnsPresent.length === 0) {
    return {
      rows: [],
      priceColumnsPresent: [],
      error: `El CSV no trae ninguna columna de precio (${PRICE_SLOT_KEYS.map((k) => PRICE_SLOT_COLUMN[k]).join(', ')}).`,
    }
  }

  return { rows: records, priceColumnsPresent, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan (dry-run) — NO escribe
// ─────────────────────────────────────────────────────────────────────────────

type DbRow = {
  id: string
  linea: string
  style_name: string
  tipologia_code: string
  variante: string
  sistema_constructivo: string
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
}

async function loadMarcaCatalog(
  client: SupabaseClient,
  marcaId: string,
): Promise<DbRow[]> {
  const cols =
    'id, linea, style_name, tipologia_code, variante, sistema_constructivo, precio_lista_usd, precio_contado_usd, precio_pozo_usd'
  const out: DbRow[] = []
  const PAGE = 1000
  let from = 0
  // Paginado defensivo (PostgREST capea ~1000 server-side).
  for (;;) {
    const { data, error } = await client
      .from('house_catalog')
      .select(cols)
      .eq('marca_id', marcaId)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`house_catalog: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as DbRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

export async function buildImportPlan(
  client: SupabaseClient,
  marcaId: string,
  parsed: ParsedCsv,
): Promise<ImportPlan> {
  const dbRows = await loadMarcaCatalog(client, marcaId)
  const dbByKey = new Map<string, DbRow>()
  for (const r of dbRows) {
    dbByKey.set(
      compositeKey(r as unknown as Record<KeyColumn, unknown>),
      r,
    )
  }

  const plan: ImportPlan = {
    marcaId,
    priceColumnsPresent: parsed.priceColumnsPresent,
    updates: [],
    unchanged: 0,
    unmatched: [],
    invalid: [],
    duplicates: [],
    dbRowsTotal: dbRows.length,
    dbRowsNotInCsv: 0,
  }

  const seenCsvKeys = new Map<string, number>() // key → veces visto
  const touchedDbIds = new Set<string>()
  // Updates candidatos con su clave (para descartar duplicados al final).
  const candidates: { ck: string; update: PlannedUpdate }[] = []

  parsed.rows.forEach((row, idx) => {
    const line = idx + 2 // +1 header, +1 base-1
    const keyObj = Object.fromEntries(
      KEY_COLUMNS.map((c) => [c, row[c]]),
    ) as Record<KeyColumn, unknown>

    const missing = KEY_COLUMNS.filter(
      (c) => String(row[c] ?? '').trim() === '',
    )
    if (missing.length > 0) {
      plan.invalid.push({
        line,
        reason: `clave incompleta (faltan: ${missing.join(', ')})`,
      })
      return
    }

    const ck = compositeKey(keyObj)
    const human = KEY_COLUMNS.map((c) => String(row[c]).trim()).join(' · ')
    seenCsvKeys.set(ck, (seenCsvKeys.get(ck) ?? 0) + 1)

    // Validar precios presentes para esta fila.
    const set: PriceSet = {}
    let rowInvalid = false
    for (const slot of parsed.priceColumnsPresent) {
      const v = parsePrice(row[PRICE_SLOT_COLUMN[slot]])
      if (v === null) {
        plan.invalid.push({
          line,
          reason: `${PRICE_SLOT_COLUMN[slot]} inválido en "${human}"`,
        })
        rowInvalid = true
        break
      }
      if (v !== undefined) set[slot] = v
    }
    if (rowInvalid) return

    const db = dbByKey.get(ck)
    if (!db) {
      plan.unmatched.push(human)
      return
    }

    const before: PriceSet = {}
    const changes: PriceSet = {}
    for (const slot of parsed.priceColumnsPresent) {
      if (!(slot in set)) continue
      const col = PRICE_SLOT_COLUMN[slot]
      const cur = db[col as keyof DbRow] as number | null
      before[slot] = cur ?? undefined
      // Comparar con tolerancia (la DB guarda numeric; evitar ruido float).
      if (cur == null || Math.abs(Number(cur) - set[slot]!) > 0.005) {
        changes[slot] = set[slot]
      }
    }

    touchedDbIds.add(db.id)
    if (Object.keys(changes).length === 0) {
      plan.unchanged += 1
    } else {
      candidates.push({ ck, update: { id: db.id, label: human, before, set: changes } })
    }
  })

  // Claves repetidas dentro del CSV → ambiguas: NO se aplican (no sabemos
  // cuál fila gana). Se reportan; sus updates se descartan.
  const dupKeys = new Set<string>()
  for (const [k, n] of seenCsvKeys) if (n > 1) dupKeys.add(k)

  for (const c of candidates) {
    if (dupKeys.has(c.ck)) continue
    plan.updates.push(c.update)
  }
  for (const k of dupKeys) {
    // Mostrar la representación humana de una de las filas con esa clave.
    const sample = parsed.rows.find(
      (r) =>
        compositeKey(
          Object.fromEntries(KEY_COLUMNS.map((c) => [c, r[c]])) as Record<
            KeyColumn,
            unknown
          >,
        ) === k,
    )
    plan.duplicates.push(
      sample
        ? KEY_COLUMNS.map((c) => String(sample[c]).trim()).join(' · ')
        : k,
    )
  }

  plan.dbRowsNotInCsv = dbRows.length - touchedDbIds.size
  return plan
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply — escribe (service-role). Sólo columnas que cambian.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyResult {
  updated: number
  failed: number
  errors: string[]
}

export async function applyImportPlan(
  client: SupabaseClient,
  plan: ImportPlan,
): Promise<ApplyResult> {
  const res: ApplyResult = { updated: 0, failed: 0, errors: [] }
  const CHUNK = 25 // concurrencia acotada (admin one-off, ~cientos de filas)
  for (let i = 0; i < plan.updates.length; i += CHUNK) {
    const slice = plan.updates.slice(i, i + CHUNK)
    const results = await Promise.all(
      slice.map(async (u) => {
        const patch: Record<string, number> = {}
        for (const [slot, val] of Object.entries(u.set)) {
          patch[PRICE_SLOT_COLUMN[slot as PriceSlotKey]] = val as number
        }
        const { error } = await client
          .from('house_catalog')
          .update(patch)
          .eq('id', u.id)
        return { ok: !error, label: u.label, msg: error?.message }
      }),
    )
    for (const r of results) {
      if (r.ok) res.updated += 1
      else {
        res.failed += 1
        if (res.errors.length < 10)
          res.errors.push(`${r.label}: ${r.msg ?? 'error'}`)
      }
    }
  }
  return res
}
