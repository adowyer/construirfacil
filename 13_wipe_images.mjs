/**
 * 13_wipe_images.mjs
 *
 * Limpia el catálogo de imágenes para empezar de cero después de la
 * reorganización del Drive. Borra:
 *
 *   1. Todos los archivos del bucket `house-photos` en Supabase Storage
 *      (lista recursivamente, borra en chunks de 1000).
 *   2. Todas las filas de `public.model_images`. CASCADE encadena el
 *      borrado a `public.model_image_skus` (creada por la migración 0010).
 *
 * NO toca:
 *   - El bucket en sí (solo lo vacía).
 *   - La tabla model_images (solo borra contenido).
 *   - Otras tablas del catálogo (house_catalog, lineas, marcas, etc).
 *
 * Después de correr esto, el sync nuevo (04_sync_drive_photos.mjs reescrito)
 * va a popular todo desde cero leyendo el árbol reorganizado del Drive.
 *
 * Idempotente: si está vacío, no hace nada.
 *
 * Uso:
 *   node 13_wipe_images.mjs --dry-run    # solo lista, no borra
 *   node 13_wipe_images.mjs              # ejecuta el wipe
 *
 * Lee `.env.local` automáticamente.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── Cargar .env.local manualmente ──────────────────────────────────────
function loadDotenv(filename) {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(here, filename)
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  console.error('❌ Faltan vars de Supabase en .env.local o el entorno.')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const BUCKET = 'house-photos'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ─────────────────────────────────────────────────────────────────────────
// 1. Listar TODO el bucket recursivamente
// ─────────────────────────────────────────────────────────────────────────
//
// Supabase Storage `list()` devuelve solo el contenido directo de un path.
// Items con `id === null` son carpetas → recursamos.
//
async function listAllInBucket(path = '') {
  const out = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(path, { limit: PAGE, offset })

    if (error) {
      throw new Error(`list("${path}") falló: ${error.message}`)
    }
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name
      if (item.id === null) {
        // Carpeta — recursar
        const sub = await listAllInBucket(fullPath)
        out.push(...sub)
      } else {
        out.push(fullPath)
      }
    }

    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Borrar archivos en chunks (la API acepta hasta 1000 paths por request)
// ─────────────────────────────────────────────────────────────────────────
async function removeInChunks(paths) {
  const CHUNK = 1000
  let removed = 0
  for (let i = 0; i < paths.length; i += CHUNK) {
    const chunk = paths.slice(i, i + CHUNK)
    const { data, error } = await supabase.storage.from(BUCKET).remove(chunk)
    if (error) {
      throw new Error(`remove() falló en chunk ${i}: ${error.message}`)
    }
    removed += (data ?? []).length
    if (paths.length > CHUNK) {
      console.log(`  … ${Math.min(i + CHUNK, paths.length)} / ${paths.length}`)
    }
  }
  return removed
}

// ─────────────────────────────────────────────────────────────────────────
// 3. DELETE FROM model_images
// ─────────────────────────────────────────────────────────────────────────
//
// Postgrest exige un filtro en delete(). Usamos un predicado que matchea
// todas las filas existentes. CASCADE encadena a model_image_skus.
//
async function deleteAllModelImages() {
  const { error, count } = await supabase
    .from('model_images')
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01')

  if (error) {
    throw new Error(`delete model_images falló: ${error.message}`)
  }
  return count ?? 0
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no borra)' : 'EJECUTAR WIPE'}`)
  console.log(`Bucket: ${BUCKET}`)
  console.log()

  // ── Snapshot inicial ──
  console.log('▸ Listando archivos del bucket…')
  const files = await listAllInBucket('')
  console.log(`  Total archivos en bucket: ${files.length}`)

  const { count: rowCount, error: countErr } = await supabase
    .from('model_images')
    .select('id', { count: 'exact', head: true })
  if (countErr) {
    console.error(`❌ Error contando model_images: ${countErr.message}`)
    process.exit(1)
  }
  console.log(`  Total filas en model_images: ${rowCount ?? 0}`)
  console.log()

  if (files.length === 0 && (rowCount ?? 0) === 0) {
    console.log('Nada que borrar. Listo.')
    return
  }

  // ── Muestra ──
  if (files.length > 0) {
    console.log('Muestra de archivos a borrar (primeros 5):')
    for (const f of files.slice(0, 5)) console.log(`  ${f}`)
    if (files.length > 5) console.log(`  … y ${files.length - 5} más`)
    console.log()
  }

  if (DRY_RUN) {
    console.log('DRY-RUN: no se borró nada.')
    return
  }

  // ── Borrado ──
  if (files.length > 0) {
    console.log(`▸ Borrando ${files.length} archivos del bucket…`)
    const removed = await removeInChunks(files)
    console.log(`  ✓ ${removed} archivos borrados del bucket.`)
  }

  if ((rowCount ?? 0) > 0) {
    console.log(`▸ Borrando ${rowCount} filas de model_images (CASCADE → model_image_skus)…`)
    const deleted = await deleteAllModelImages()
    console.log(`  ✓ ${deleted} filas borradas.`)
  }

  // ── Verificación post-wipe ──
  console.log()
  console.log('▸ Verificación final…')
  const filesAfter = await listAllInBucket('')
  const { count: rowsAfter } = await supabase
    .from('model_images')
    .select('id', { count: 'exact', head: true })
  console.log(`  Archivos en bucket: ${filesAfter.length}`)
  console.log(`  Filas en model_images: ${rowsAfter ?? 0}`)

  if (filesAfter.length === 0 && (rowsAfter ?? 0) === 0) {
    console.log()
    console.log('✓ Wipe completo. Listo para correr el sync nuevo.')
  } else {
    console.log()
    console.log('⚠ Quedaron residuos. Revisar manualmente.')
  }
}

main().catch((err) => {
  console.error('❌ Excepción:', err.message ?? err)
  process.exit(1)
})
