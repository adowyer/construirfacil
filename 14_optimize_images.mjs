#!/usr/bin/env node
/**
 * 14_optimize_images.mjs
 *
 * Recorre `model_images` y genera, para cada foto, dos variantes WebP:
 *   - <path>-thumb.webp   ~400px wide,  q70 — para cards/listados.
 *   - <path>.webp         ~1920px max,  q80 — para galerías/expandido.
 *
 * Sube ambas al mismo bucket (`house-photos`) y popula las columnas
 * `thumb_url` y `webp_url` (migración 0018).
 *
 * Idempotente: filas con ambas columnas pobladas se saltean.
 *
 * Egress: descarga vía `storage.download()` (internal, NO cuenta para
 * egress) en lugar de fetch al public URL. Para 2000 imágenes esto
 * equivale a 0 GB de egress — clave para no profundizar el problema
 * mientras lo resolvemos.
 *
 * Uso:
 *   node 14_optimize_images.mjs --dry-run
 *   node 14_optimize_images.mjs --limit=50
 *   node 14_optimize_images.mjs              # todas
 *
 * Lee SUPABASE_URL + SUPABASE_SERVICE_KEY de .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── .env.local ──────────────────────────────────────────────────────────
function loadDotenv(filename) {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(here, filename)
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadDotenv('.env.local')
loadDotenv('.env')

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='))
  if (!arg) return null
  const n = Number(arg.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : null
})()
/**
 * Modo `--reoptimize-stale`: además de procesar filas con thumb/webp NULL,
 * detecta y reoptimiza filas cuyas URLs optimizadas apuntan a un path
 * distinto al `storage_path` actual (situación típica después de renombrar
 * archivos en Drive — el sync re-popula storage_path pero las URLs
 * optimizadas quedan apuntando al path viejo).
 *
 * Para las filas stale, NULL-ea primero thumb_url + webp_url y luego las
 * procesa como nuevas.
 */
const REOPT_STALE = process.argv.includes('--reoptimize-stale')

const BUCKET = 'house-photos'

// Parámetros de optimización
const THUMB_WIDTH = 400         // px (resize fit: inside, no enlarge)
const THUMB_QUALITY = 70
const FULL_MAX_WIDTH = 1920     // px (resize fit: inside, no enlarge)
const FULL_QUALITY = 80

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── Helpers ─────────────────────────────────────────────────────────────

/** Reemplaza la extensión por `.webp` o `-thumb.webp`. */
function deriveWebpPath(storagePath, kind /* 'thumb' | 'full' */) {
  const lastDot = storagePath.lastIndexOf('.')
  const base = lastDot > 0 ? storagePath.slice(0, lastDot) : storagePath
  return kind === 'thumb' ? `${base}-thumb.webp` : `${base}.webp`
}

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function downloadOriginal(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`download: ${error.message}`)
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadWebp(path, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/webp', upsert: true })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  return publicUrl(path)
}

async function processRow(row) {
  if (!row.storage_path) {
    return { status: 'skipped', reason: 'sin storage_path' }
  }
  // PDFs (planos en PDF, si los hay) — no convertimos a WebP.
  if (/\.pdf$/i.test(row.storage_path)) {
    return { status: 'skipped', reason: 'pdf' }
  }
  if (row.thumb_url && row.webp_url) {
    return { status: 'skipped', reason: 'ya optimizada' }
  }

  const original = await downloadOriginal(row.storage_path)

  // Generar thumbnail
  const thumbBuf = await sharp(original)
    .rotate() // aplica EXIF orientation
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer()

  // Generar full optimizado
  const fullBuf = await sharp(original)
    .rotate()
    .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: FULL_QUALITY })
    .toBuffer()

  const thumbPath = deriveWebpPath(row.storage_path, 'thumb')
  const fullPath = deriveWebpPath(row.storage_path, 'full')

  if (DRY_RUN) {
    return {
      status: 'dry-run',
      originalKb: Math.round(original.length / 1024),
      thumbKb: Math.round(thumbBuf.length / 1024),
      fullKb: Math.round(fullBuf.length / 1024),
      thumbPath,
      fullPath,
    }
  }

  const thumbUrl = await uploadWebp(thumbPath, thumbBuf)
  const fullUrl = await uploadWebp(fullPath, fullBuf)

  const { error: upErr } = await supabase
    .from('model_images')
    .update({ thumb_url: thumbUrl, webp_url: fullUrl })
    .eq('id', row.id)
  if (upErr) throw new Error(`update row: ${upErr.message}`)

  return {
    status: 'ok',
    originalKb: Math.round(original.length / 1024),
    thumbKb: Math.round(thumbBuf.length / 1024),
    fullKb: Math.round(fullBuf.length / 1024),
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Optimize images → WebP thumb + full')
  console.log(
    `  DRY_RUN=${DRY_RUN}  LIMIT=${LIMIT ?? '∞'}  REOPT_STALE=${REOPT_STALE}`,
  )
  console.log('═══════════════════════════════════════════════════════════\n')

  // Filtro base: filas activas con thumb/webp NULL.
  // En modo `--reoptimize-stale` traemos TODAS las activas y detectamos
  // las stale en cliente (storage_path renombrado → URLs viejas no matchean).
  let query = supabase
    .from('model_images')
    .select('id, storage_path, thumb_url, webp_url, status')
    .eq('status', 'active')
    .order('id', { ascending: true })

  if (!REOPT_STALE) {
    query = query.or('thumb_url.is.null,webp_url.is.null')
  }
  if (LIMIT) query = query.limit(LIMIT)

  const { data: allRows, error } = await query
  if (error) {
    console.error(`❌ load model_images: ${error.message}`)
    process.exit(1)
  }

  // ── Stale detection ─────────────────────────────────────────────────
  // Una fila está stale si tiene thumb_url + webp_url pero el path base de
  // alguno NO matchea con `storage_path` (sin extensión). Eso pasa cuando
  // se renombra un archivo en Drive y el sync re-popula storage_path pero
  // las URLs optimizadas quedan apuntando al path viejo.
  const isStale = (row) => {
    if (!row.thumb_url || !row.webp_url || !row.storage_path) return false
    const base = row.storage_path.replace(/\.[^./]+$/, '')
    const expectedThumb = `${base}-thumb.webp`
    const expectedFull = `${base}.webp`
    return (
      !row.thumb_url.endsWith(expectedThumb) ||
      !row.webp_url.endsWith(expectedFull)
    )
  }

  let rows = allRows
  if (REOPT_STALE) {
    const staleIds = allRows
      .filter(isStale)
      .map((r) => r.id)
    const fresh = allRows.filter(
      (r) => !r.thumb_url || !r.webp_url,
    )
    console.log(
      `  Total activas: ${allRows.length}` +
        `  · pendientes (NULL): ${fresh.length}` +
        `  · stale (URL vieja): ${staleIds.length}\n`,
    )
    // NULL-ear las stale para que el procesamiento sea uniforme.
    if (staleIds.length > 0 && !DRY_RUN) {
      const { error: nullErr } = await supabase
        .from('model_images')
        .update({ thumb_url: null, webp_url: null })
        .in('id', staleIds)
      if (nullErr) {
        console.error(`❌ null stale: ${nullErr.message}`)
        process.exit(1)
      }
      console.log(`  ✓ ${staleIds.length} filas stale NULLeadas.\n`)
    }
    rows = allRows.filter(
      (r) => !r.thumb_url || !r.webp_url || isStale(r),
    )
  }
  console.log(`  ${rows.length} filas a procesar.\n`)

  let okCount = 0
  let skipCount = 0
  let errCount = 0
  let savedKb = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const prefix = `[${i + 1}/${rows.length}]`
    try {
      const r = await processRow(row)
      if (r.status === 'skipped') {
        skipCount++
        console.log(`${prefix} ⏭  ${row.storage_path}  (${r.reason})`)
        continue
      }
      okCount++
      const saving = r.originalKb - r.fullKb - r.thumbKb
      savedKb += saving
      const tag = r.status === 'dry-run' ? '🔎' : '✓'
      console.log(
        `${prefix} ${tag} ${row.storage_path}` +
          `  ${r.originalKb}KB → thumb ${r.thumbKb}KB + full ${r.fullKb}KB` +
          `  (ahorra ${saving}KB)`,
      )
    } catch (e) {
      errCount++
      console.error(`${prefix} ❌ ${row.storage_path}: ${e.message}`)
    }
  }

  console.log('\n───────────────────────────────────────────────────────────')
  console.log(`  ok: ${okCount}   skip: ${skipCount}   err: ${errCount}`)
  console.log(`  ahorro estimado por carga de original: ${(savedKb / 1024).toFixed(1)} MB`)
  console.log('───────────────────────────────────────────────────────────')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
