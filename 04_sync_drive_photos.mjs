/**
 * 04_sync_drive_photos.mjs   (reescrito 2026-05-05)
 * ----------------------------------------------------------------------------
 * Sincroniza el Catálogo HAUSIND® del Google Drive → Supabase Storage +
 * tablas `model_images` y `model_image_skus` (ver migración 0010).
 *
 * Estructura esperada del Drive (ver Catálogo HAUSIND® local):
 *
 *   Catálogo HAUSIND®/
 *     LINEA <X>/                    X = ATLAS | BOSQUE | TERRA
 *       Tipologia <N>/              N = 1 | 2 | 3 | O | U | Z
 *         AXONOMETRIAS/             PNGs scoped a tipología (image_type=plano)
 *         Planos/                   PDFs scoped a tipología (image_type=plano)
 *         Renders/
 *           EXTERIORES/
 *             Casa <NOMBRE>/        scoped a casa (style_name)
 *           INTERIORES/
 *             Casa <NOMBRE>/        scoped a casa, O
 *             <file directo>        scoped a tipología (caso BOSQUE: interior común)
 *
 * Filename:  ^(\d+)\s+(.+?)(?:\s+V([\d.\-]+))?\.(png|jpg|jpeg|pdf)$
 *
 *   01 Frente V1.png         → orden=01, view="Frente",        variantes=[V1]
 *   05 Lateral V3-4.png      → orden=05, view="Lateral",       variantes=[V3, V4]
 *   01 Living Madera.png     → orden=01, view="Living Madera", variantes=null (todas)
 *
 * Resolución de SKUs (linkea image_id → house_catalog_id en model_image_skus):
 *   • Casa <X> con tag V<lista>:  SKUs (style_name=X, variante ∈ lista)
 *   • Casa <X> sin tag V:         SKUs (style_name=X, cualquier variante)
 *   • INTERIORES sin Casa X:      SKUs de toda la tipología, filtrado por tag V
 *   • AXONOMETRIAS / Planos:      SKUs de toda la tipología, filtrado por tag V
 *
 * Idempotente:
 *   • Match por drive_file_id; saltea si drive_modified_time no cambió.
 *   • Re-syncs reemplazan los model_image_skus (delete + insert).
 *   • Archivos que ya no aparecen en Drive → status='archived'.
 *
 * Uso:
 *   export GOOGLE_SERVICE_ACCOUNT_JSON='{...}'
 *   export DRIVE_ROOT_FOLDER_ID='1AbCdEf...'
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_KEY=...
 *   node 04_sync_drive_photos.mjs --dry-run
 *   node 04_sync_drive_photos.mjs --line=BOSQUE
 *   node 04_sync_drive_photos.mjs --verbose
 *
 * Lee `.env.local` si existe.
 * ----------------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import mime from 'mime-types'
import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── Cargar .env.local manualmente ───────────────────────────────────────
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
const GOOGLE_SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')
const LINE_FILTER =
  (process.argv.find((a) => a.startsWith('--line=')) || '').split('=')[1] || null

if (!ROOT_FOLDER_ID) {
  console.error('❌ Falta DRIVE_ROOT_FOLDER_ID')
  process.exit(1)
}
if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_SA_JSON)) {
  console.error('❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY / GOOGLE_SERVICE_ACCOUNT_JSON')
  process.exit(1)
}

const BUCKET = 'house-photos'
const FILENAME_RE = /^(\d+)\s+(.+?)(?:\s+V([\d.\-]+))?\.(png|jpg|jpeg|pdf)$/i

// ─────────────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────────────

/** "Casa AMBA’Y" → "AMBA'Y"   |   "Casa CALIFORNIA (moderno)" → "CALIFORNIA" */
function casaToStyleName(folderName) {
  if (!folderName) return null
  let s = String(folderName).normalize('NFC')
  // Strip prefijo "Casa "
  s = s.replace(/^casa\s+/i, '')
  // Strip suffijo " (estilo)"  (ATLAS folder names traen el estilo entre paréntesis)
  s = s.replace(/\s*\([^)]*\)\s*$/, '')
  // Normalizar curly quotes a ASCII
  s = s.replace(/[’‘`´]/g, "'")
  return s.trim()
}

/** "Tipologia 1" → "1"   |   "Tipologia O" → "O" */
function folderToTipologiaCode(folderName) {
  const m = String(folderName).match(/^tipolog[ií]a\s+(\S+)/i)
  return m ? m[1].toUpperCase() : null
}

/** "LINEA BOSQUE" → "BOSQUE" */
function folderToLinea(folderName) {
  const m = String(folderName).match(/^l[ií]nea\s+(\w+)/i)
  return m ? m[1].toUpperCase() : null
}

/** "V2-3-4" → ["V2","V3","V4"]   |   "V3.1" → ["V3.1"]   |   null → null */
function parseVariantTag(tag) {
  if (!tag) return null
  return tag
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `V${s}`)
}

/** Para matching: "V2" → "2", "V3.1" → "3.1". Null si nulo. */
function stripV(v) {
  if (v == null) return null
  return String(v).replace(/^V/i, '').trim()
}

/** Slug seguro para path en Storage. "Casa AMBA’Y" → "casa-amba-y" excepto que
 *  borramos los caracteres de apóstrofo (queda "casa-ambay"). */
function slug(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────
// Resolución de path → contexto semántico
// ─────────────────────────────────────────────────────────────────────────

/**
 * Dado un pathParts del Drive (sin incluir el root) y el filename,
 * devuelve el contexto que necesita el sync para crear la fila + linkear SKUs.
 *
 * Returns null si el path no matchea la estructura esperada (skip).
 */
function inferContext(pathParts, fileName) {
  // Esperamos al mínimo: LINEA X / Tipologia N / <section> / ...
  if (pathParts.length < 3) return null

  const linea = folderToLinea(pathParts[0])
  const tipologia_code = folderToTipologiaCode(pathParts[1])
  if (!linea || !tipologia_code) return null

  const section = pathParts[2] // AXONOMETRIAS | Planos | Renders

  // Parse filename
  const m = fileName.match(FILENAME_RE)
  if (!m) return null

  const sort_order = parseInt(m[1], 10)
  const view_label = m[2].trim()
  const variant_tag = m[3] || null
  const ext = m[4].toLowerCase()
  const variants = parseVariantTag(variant_tag) // null si no hay tag

  let image_type = 'render'
  let is_exterior = false
  let style_name = null  // null = scope tipología
  let casa_folder = null

  if (/^axonometrias$/i.test(section)) {
    image_type = 'axo'
    is_exterior = false
    // Scope tipología (sin Casa X)
  } else if (/^planos$/i.test(section)) {
    image_type = 'plano'
    is_exterior = false
    // Scope tipología
  } else if (/^renders$/i.test(section)) {
    if (pathParts.length < 4) return null
    const subsection = pathParts[3] // EXTERIORES | INTERIORES
    if (/^exteriores$/i.test(subsection)) {
      is_exterior = true
    } else if (/^interiores$/i.test(subsection)) {
      is_exterior = false
    } else {
      return null
    }

    if (pathParts.length === 4) {
      // Renders/INTERIORES/<file>  — caso BOSQUE: interior común a tipología
      // (Renders/EXTERIORES/<file> sin Casa X no debería existir; si pasa, scope tipología)
      style_name = null
    } else {
      // Renders/{EXT|INT}/Casa X/<file>
      casa_folder = pathParts[4]
      style_name = casaToStyleName(casa_folder)
      if (!style_name) return null
    }
  } else {
    return null
  }

  return {
    linea,
    tipologia_code,
    image_type,           // 'render' | 'plano'
    is_exterior,
    style_name,           // null = aplica a toda la tipología
    casa_folder,          // para construir el path de storage
    sort_order,
    view_label,
    variants,             // ['V2','V3'] | null
    ext,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Index de SKUs en memoria
// ─────────────────────────────────────────────────────────────────────────

/**
 * Construye un index de house_catalog para resolver rápidamente:
 *   → SKUs por (linea, tipologia_code)
 *   → SKUs por (linea, tipologia_code, style_name)
 *   → SKU concreto por (linea, tipologia_code, style_name, variante)
 *
 * El matching de style_name es case-insensitive y normaliza apóstrofos.
 * El matching de variante ignora el prefijo `V` (DB puede tener "V1" o "1").
 */
async function loadSkuIndex(supabase) {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('id, linea, tipologia_code, style_name, variante')

  if (error) throw new Error(`house_catalog load: ${error.message}`)

  const byTipologia = new Map() // key: linea::tipologia_code  → [skus]
  const byStyle = new Map()     // key: linea::tipologia_code::style_name → [skus]
  const byVariant = new Map()   // key: linea::tipologia_code::style_name::variante → [skus]

  // Normaliza style_name y demás strings para matching:
  //   - strip de tildes (LANÍN ≡ LANIN, CAMBOATÁ ≡ CAMBOATA)
  //   - apóstrofos curly → ASCII (AMBA’Y ≡ AMBA'Y)
  //   - UPPERCASE + trim
  //   - strip prefijo "LINEA " (DB guarda "LÍNEA TERRA"; folderToLinea extrae
  //     "TERRA"). Se aplica acá para que ambos lados converjan.
  // El style_name original (con/sin acento) se conserva en los rows de DB; esto
  // es solo la KEY del index para que el folder del Drive matchee con DB sin
  // depender de la consistencia exacta de acentos.
  function norm(s) {
    if (s == null) return ''
    return String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’‘`´]/g, "'")
      .trim()
      .toUpperCase()
      .replace(/^LINEA\s+/, '')
  }

  for (const r of data || []) {
    if (!r.linea || !r.tipologia_code) continue
    const linea = norm(r.linea)
    const tip = norm(r.tipologia_code)
    const style = norm(r.style_name)
    const variant = stripV(r.variante)

    const tipKey = `${linea}::${tip}`
    if (!byTipologia.has(tipKey)) byTipologia.set(tipKey, [])
    byTipologia.get(tipKey).push(r)

    if (style) {
      const styleKey = `${tipKey}::${style}`
      if (!byStyle.has(styleKey)) byStyle.set(styleKey, [])
      byStyle.get(styleKey).push(r)

      if (variant != null) {
        const vKey = `${styleKey}::${variant}`
        if (!byVariant.has(vKey)) byVariant.set(vKey, [])
        byVariant.get(vKey).push(r)
      }
    }
  }

  return {
    byTipologia,
    byStyle,
    byVariant,
    norm,
  }
}

/**
 * Resuelve los house_catalog_id que matchean el contexto de una imagen.
 * Devuelve [] si no hay matches (la imagen se inserta de todos modos en
 * model_images, pero sin links en model_image_skus).
 */
function resolveSkus(idx, ctx) {
  const linea = idx.norm(ctx.linea)
  const tip = idx.norm(ctx.tipologia_code)
  const style = ctx.style_name ? idx.norm(ctx.style_name) : null

  let candidates = []
  if (style) {
    const styleKey = `${linea}::${tip}::${style}`
    candidates = idx.byStyle.get(styleKey) || []
  } else {
    const tipKey = `${linea}::${tip}`
    candidates = idx.byTipologia.get(tipKey) || []
  }

  if (!ctx.variants) {
    // Sin tag V: aplica a TODOS los candidatos
    return candidates.map((c) => c.id)
  }

  // Con tag V: filtrar por variantes (matching ignora prefijo "V")
  const wantedSet = new Set(ctx.variants.map((v) => stripV(v)))
  return candidates
    .filter((c) => wantedSet.has(stripV(c.variante)))
    .map((c) => c.id)
}

// ─────────────────────────────────────────────────────────────────────────
// Drive helpers
// ─────────────────────────────────────────────────────────────────────────

async function getDrive() {
  const credentials = JSON.parse(GOOGLE_SA_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const client = await auth.getClient()
  return google.drive({ version: 'v3', auth: client })
}

async function listChildren(drive, folderId) {
  const all = []
  let pageToken = null
  do {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    all.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return all
}

const ACCEPTED_MIME = (m) =>
  (m && m.startsWith('image/')) || m === 'application/pdf'

async function walkDrive(drive, folderId, pathParts = []) {
  const entries = await listChildren(drive, folderId)
  const results = []
  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      const child = await walkDrive(drive, entry.id, [...pathParts, entry.name])
      results.push(...child)
    } else if (ACCEPTED_MIME(entry.mimeType)) {
      results.push({ file: entry, pathParts })
    }
  }
  return results
}

async function downloadFile(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data)
}

// ─────────────────────────────────────────────────────────────────────────
// Storage + DB writes
// ─────────────────────────────────────────────────────────────────────────

function storagePathFor(ctx, fileName) {
  const parts = [ctx.linea.toLowerCase()]
  parts.push(`t${ctx.tipologia_code.toLowerCase()}`)
  if (ctx.image_type === 'plano') {
    // axonometrias o planos: scope tipología
    // Distinguir AXONOMETRIAS vs Planos por extensión es ambiguo; usamos un solo bucket.
    parts.push('planos')
  } else {
    parts.push(ctx.is_exterior ? 'exteriores' : 'interiores')
    if (ctx.casa_folder) parts.push(slug(ctx.casa_folder))
  }
  parts.push(slug(fileName))
  return parts.join('/')
}

async function uploadToStorage(supabase, storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw error
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return pub.publicUrl
}

async function replaceSkuLinks(supabase, imageId, skuIds) {
  // delete-then-insert (más simple y robusto que upsert por composite)
  const { error: delErr } = await supabase
    .from('model_image_skus')
    .delete()
    .eq('image_id', imageId)
  if (delErr) throw new Error(`delete model_image_skus: ${delErr.message}`)

  if (skuIds.length === 0) return
  const rows = skuIds.map((id) => ({ image_id: imageId, house_catalog_id: id }))
  const { error: insErr } = await supabase.from('model_image_skus').insert(rows)
  if (insErr) throw new Error(`insert model_image_skus: ${insErr.message}`)
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Sync Drive → Supabase Storage + model_images + model_image_skus')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Modo:         ${DRY_RUN ? 'DRY RUN (no escribe)' : 'EJECUTAR'}`)
  console.log(`  Filtro línea: ${LINE_FILTER || 'todas'}`)
  console.log()

  const drive = await getDrive()
  const supabase = !DRY_RUN
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null

  // ── 1. Walk Drive ────────────────────────────────────────────────────
  console.log('▸ Recorriendo Drive…')
  const allFiles = await walkDrive(drive, ROOT_FOLDER_ID)
  console.log(`  ✓ ${allFiles.length} archivos aceptados`)

  // ── 2. Cargar index de SKUs ───────────────────────────────────────────
  // Cargamos siempre (también en dry-run) para que el log muestre el
  // verdadero count de SKUs por archivo. El gate previo `if (!DRY_RUN || VERBOSE)`
  // dejaba skuIndex=null en dry-run y todos los logs reportaban "0 SKUs"
  // aunque el match estuviera bien.
  const sb = supabase || createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const skuIndex = await loadSkuIndex(sb)
  const totalSkus = [...skuIndex.byTipologia.values()].reduce((a, b) => a + b.length, 0)
  console.log(`  ✓ ${totalSkus} SKUs cargados de house_catalog`)

  // ── 3. Cargar registros existentes (para idempotencia + archive) ──────
  const existingByDriveId = new Map()
  if (!DRY_RUN) {
    const { data, error } = await supabase
      .from('model_images')
      .select('id, drive_file_id, drive_modified_time, status')
    if (error) {
      console.error(`❌ load model_images: ${error.message}`)
      process.exit(1)
    }
    for (const r of data || []) {
      if (r.drive_file_id) existingByDriveId.set(r.drive_file_id, r)
    }
    console.log(`  ✓ ${existingByDriveId.size} registros previos en DB`)
  }
  console.log()

  // ── 4. Procesar archivos ──────────────────────────────────────────────
  const counters = {
    processed: 0,
    uploaded: 0,
    updated: 0,
    skipped: 0,
    archived: 0,
    unmatched_path: 0,
    unmatched_sku: 0,
    errored: 0,
  }
  const seenInDrive = new Set()

  for (const { file, pathParts } of allFiles) {
    seenInDrive.add(file.id)

    const ctx = inferContext(pathParts, file.name)
    if (!ctx) {
      counters.unmatched_path++
      if (VERBOSE) {
        console.log(`  ⚠ path/filename no matchea: ${pathParts.join('/')}/${file.name}`)
      }
      continue
    }

    if (LINE_FILTER && ctx.linea !== LINE_FILTER.toUpperCase()) continue

    const skuIds = skuIndex ? resolveSkus(skuIndex, ctx) : []
    if (skuIndex && skuIds.length === 0) {
      counters.unmatched_sku++
      if (VERBOSE) {
        console.log(
          `  ⚠ sin SKUs:  ${ctx.linea}/T${ctx.tipologia_code} ${ctx.style_name || '(tipología)'} V[${(ctx.variants || []).join(',')}]  ${file.name}`,
        )
      }
      // seguimos: insertamos la imagen en model_images aunque no linkee a nada
    }

    const exists = existingByDriveId.get(file.id)
    // drive_modified_time se guarda en timestamptz: Drive lo manda como ISO con `Z`,
    // PostgreSQL lo devuelve como ISO con `+00:00`. Comparar como Date para evitar
    // re-uploads espurios.
    const driveTs = file.modifiedTime ? new Date(file.modifiedTime).getTime() : null
    const dbTs = exists?.drive_modified_time ? new Date(exists.drive_modified_time).getTime() : null
    if (exists && dbTs != null && dbTs === driveTs && exists.status === 'active') {
      counters.skipped++
      continue
    }

    if (DRY_RUN) {
      counters.processed++
      if (VERBOSE || counters.processed <= 15) {
        const variantStr = ctx.variants ? `[${ctx.variants.join(',')}]` : '[*]'
        console.log(
          `  → ${ctx.linea}/T${ctx.tipologia_code}/${ctx.image_type === 'plano' ? 'PLANOS' : ctx.is_exterior ? 'EXT' : 'INT'}/${ctx.style_name || '(tipología)'} V${variantStr}  ${file.name}  →  ${skuIds.length} SKUs`,
        )
      }
      continue
    }

    // ── Descarga + sube + escribe DB ───────────────────────────────────
    try {
      const buffer = await downloadFile(drive, file.id)

      // Metadata (solo si es imagen)
      let width = null,
        height = null,
        lqipColor = '#e5e5e5'
      if (file.mimeType?.startsWith('image/')) {
        try {
          const meta = await sharp(buffer).metadata()
          width = meta.width || null
          height = meta.height || null
          const tiny = await sharp(buffer).resize(1, 1).raw().toBuffer()
          if (tiny.length >= 3) {
            lqipColor = `#${tiny[0].toString(16).padStart(2, '0')}${tiny[1].toString(16).padStart(2, '0')}${tiny[2].toString(16).padStart(2, '0')}`
          }
        } catch {
          /* swallow */
        }
      }

      const sPath = storagePathFor(ctx, file.name)
      const publicUrl = await uploadToStorage(supabase, sPath, buffer, file.mimeType)

      // Para columnas legacy: solo populamos `variante` cuando es UNA variante exacta.
      const legacyVariant =
        ctx.variants && ctx.variants.length === 1 ? ctx.variants[0] : null

      const record = {
        linea: ctx.linea,
        tipologia_code: ctx.tipologia_code,
        style_name: ctx.style_name,
        variante: legacyVariant,
        is_exterior: ctx.is_exterior,
        image_type: ctx.image_type,
        view_label: ctx.view_label,
        sort_order: ctx.sort_order,
        storage_path: sPath,
        storage_url: publicUrl,
        width,
        height,
        lqip_color: lqipColor,
        drive_file_id: file.id,
        drive_modified_time: file.modifiedTime,
        drive_path: pathParts.join('/'),
        status: 'active',
        updated_at: new Date().toISOString(),
      }

      const { data: upserted, error: upErr } = await supabase
        .from('model_images')
        .upsert(record, { onConflict: 'drive_file_id' })
        .select('id')
        .single()
      if (upErr) throw new Error(`upsert model_images: ${upErr.message}`)

      await replaceSkuLinks(supabase, upserted.id, skuIds)

      if (exists) counters.updated++
      else counters.uploaded++
      if (VERBOSE) console.log(`  ✓ ${sPath}  (${skuIds.length} SKUs)`)
    } catch (err) {
      counters.errored++
      console.error(`  ❌ ${file.name}: ${err.message}`)
    }

    counters.processed++
    if (counters.processed % 25 === 0) {
      console.log(`  … ${counters.processed} procesados`)
    }
  }

  // ── 5. Archivar fotos que ya no están en Drive ────────────────────────
  if (!DRY_RUN) {
    for (const [driveId, row] of existingByDriveId) {
      if (!seenInDrive.has(driveId) && row.status !== 'archived') {
        await supabase
          .from('model_images')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        counters.archived++
      }
    }
  }

  // ── Resumen ────────────────────────────────────────────────────────────
  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Procesadas:        ${counters.processed}`)
  console.log(`  Subidas (nuevas):  ${counters.uploaded}`)
  console.log(`  Actualizadas:      ${counters.updated}`)
  console.log(`  Sin cambios:       ${counters.skipped}`)
  console.log(`  Archivadas:        ${counters.archived}`)
  console.log(`  ⚠ Path no matchea: ${counters.unmatched_path}`)
  console.log(`  ⚠ Sin SKUs:        ${counters.unmatched_sku}`)
  console.log(`  ❌ Errores:         ${counters.errored}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((err) => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
