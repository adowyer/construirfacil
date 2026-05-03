/**
 * 04_sync_drive_photos.mjs
 * ----------------------------------------------------------------------------
 * Sincroniza fotos de Google Drive → Supabase Storage + tabla model_images.
 *
 * Recorre la estructura del Drive (que vos definís) y aplica reglas para
 * detectar línea, tipología, estilo, variante, sistema constructivo, ambiente.
 *
 * Estructura esperada (todos los niveles intermedios son opcionales):
 *
 *   Casas Hausind/
 *     Línea Bosque/
 *       [Wood Plus/]               ← opcional: sistema constructivo
 *         Tipología 1/
 *           Renders/
 *             Exteriores/          ← o "Interiores"
 *               Amba'y/            ← estilo (nombre comercial)
 *                 Variante 1/
 *                   foto_001.jpg
 *                   foto_002.jpg
 *               [Cocina/]          ← opcional: room_type (interiores)
 *                 foto_003.jpg
 *
 * El script:
 *   1. Lista recursivamente la carpeta raíz indicada
 *   2. Por cada imagen, infiere los campos del path
 *   3. Descarga, sube a Supabase Storage, registra en model_images
 *   4. Idempotente: usa drive_file_id + drive_modified_time
 *   5. Si una foto fue borrada de Drive, marca el registro como archived
 *
 * REQUIERE:
 *   • Service Account de Google Cloud con permisos en la carpeta raíz
 *   • npm install googleapis @supabase/supabase-js mime-types sharp
 *
 * USO:
 *   export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   export DRIVE_ROOT_FOLDER_ID='1AbCdEf...'
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_KEY=...
 *   node 04_sync_drive_photos.mjs
 *
 * Modos:
 *   --dry-run        : lista lo que sincronizaría sin escribir
 *   --line=BOSQUE    : sincroniza solo una línea
 *   --verbose
 * ----------------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import mime from 'mime-types'
import sharp from 'sharp'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_SA_JSON       = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const ROOT_FOLDER_ID       = process.env.DRIVE_ROOT_FOLDER_ID

const DRY_RUN  = process.argv.includes('--dry-run')
const VERBOSE  = process.argv.includes('--verbose')
const LINE_FILTER = (process.argv.find(a => a.startsWith('--line=')) || '').split('=')[1]

if (!ROOT_FOLDER_ID) {
  console.error('❌ Configurá DRIVE_ROOT_FOLDER_ID')
  process.exit(1)
}
if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_SA_JSON)) {
  console.error('❌ Configurá SUPABASE_URL, SUPABASE_SERVICE_KEY y GOOGLE_SERVICE_ACCOUNT_JSON')
  process.exit(1)
}

const BUCKET = 'house-photos'

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de mapeo: nombres de carpeta → campos
// ─────────────────────────────────────────────────────────────────────────────

const LINEA_PATTERNS = [
  { pattern: /\b(bosque)\b/i,  value: 'BOSQUE' },
  { pattern: /\b(atlas)\b/i,   value: 'ATLAS' },
  { pattern: /\b(terra)\b/i,   value: 'TERRA' },
]

const SISTEMA_PATTERNS = [
  { pattern: /\bwood\s*plus\b/i,     value: 'WOOD PLUS' },
  { pattern: /\bsteel\s*plus\b/i,    value: 'STEEL PLUS' },
  { pattern: /\bhormig[oó]n\s*plus\b/i, value: 'HORMIGÓN PLUS' },
]

const TIPOLOGIA_PATTERNS = [
  { pattern: /tipolog[ií]a\s*1\b/i, value: '1' },
  { pattern: /tipolog[ií]a\s*2\b/i, value: '2' },
  { pattern: /tipolog[ií]a\s*3\b/i, value: '3' },
  { pattern: /tipolog[ií]a\s*([uoz])\b/i, group: 1, transform: s => s.toUpperCase() },
  { pattern: /^t([123])$/i, group: 1 },
  { pattern: /^t([uoz])$/i, group: 1, transform: s => s.toUpperCase() },
]

const VARIANTE_PATTERN = /\bvariante\s*(\d+)\b/i

const ROOM_PATTERNS = [
  { pattern: /^cocina/i,       value: 'cocina' },
  { pattern: /^ba[ñn]o/i,      value: 'baño' },
  { pattern: /^dormitor/i,     value: 'dormitorio' },
  { pattern: /^living/i,       value: 'living' },
  { pattern: /^comedor/i,      value: 'comedor' },
  { pattern: /^toilette/i,     value: 'toilette' },
  { pattern: /^lavader/i,      value: 'lavadero' },
  { pattern: /^parrilla/i,     value: 'parrilla' },
  { pattern: /^galer[ií]a/i,   value: 'galeria' },
  { pattern: /^escritorio/i,   value: 'escritorio' },
]

const NORMALIZED_KNOWN_STYLES = [
  // Atlas
  'PAMPA','ESCANDINAVIA','LANCASTER','PATAGONIA','CALIFORNIA',
  // Bosque
  'AMBAY','LAPACHO','CAMBOATA','ALECRIN','GUAYUBIRA','TIMBO','CEDRO','INGA','ANCHICO',
  // Terra
  'COPAHUE','DOMUYO','LANIN','MAHUIDA','TROMEN',
]

function normalizeFolderToStyle(name) {
  const norm = String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '').replace(/\s+/g, '').toUpperCase()
  return NORMALIZED_KNOWN_STYLES.includes(norm) ? norm : null
}

function matchPattern(name, patterns) {
  for (const p of patterns) {
    const m = name.match(p.pattern)
    if (m) {
      let v = p.group != null ? m[p.group] : p.value
      if (p.transform) v = p.transform(v)
      return v
    }
  }
  return null
}

/**
 * Infiere los campos a partir de la lista de carpetas en el path
 * (de raíz a inmediato padre del archivo).
 */
function inferFromPath(pathParts, fileName) {
  const ctx = {
    linea: null,
    sistema_constructivo: null,
    tipologia_code: null,
    style_name: null,
    variante: null,
    is_exterior: true,
    room_type: null,
  }

  for (const part of pathParts) {
    if (!ctx.linea)    ctx.linea = matchPattern(part, LINEA_PATTERNS)
    if (!ctx.sistema_constructivo) ctx.sistema_constructivo = matchPattern(part, SISTEMA_PATTERNS)
    if (!ctx.tipologia_code) ctx.tipologia_code = matchPattern(part, TIPOLOGIA_PATTERNS)

    const vmatch = part.match(VARIANTE_PATTERN)
    if (vmatch) ctx.variante = vmatch[1]

    if (/^exteriores?$/i.test(part)) ctx.is_exterior = true
    if (/^interiores?$/i.test(part)) ctx.is_exterior = false

    if (!ctx.room_type) ctx.room_type = matchPattern(part, ROOM_PATTERNS)

    if (!ctx.style_name) {
      const s = normalizeFolderToStyle(part)
      if (s) ctx.style_name = s
    }
  }

  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive helpers
// ─────────────────────────────────────────────────────────────────────────────

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

/** Walk recursivo, devuelve [{file, pathParts}] solo de imágenes */
async function walkDrive(drive, folderId, pathParts = []) {
  const entries = await listChildren(drive, folderId)
  const results = []
  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      const child = await walkDrive(drive, entry.id, [...pathParts, entry.name])
      results.push(...child)
    } else if (entry.mimeType?.startsWith('image/')) {
      results.push({ file: entry, pathParts })
    }
  }
  return results
}

async function downloadFile(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data)
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase helpers
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToStorage(supabase, storagePath, buffer, mimeType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw error
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return pub.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Sync Drive → Supabase Storage')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Modo:        ${DRY_RUN ? 'DRY RUN' : 'PROD'}`)
  console.log(`  Filtro línea: ${LINE_FILTER || 'todas'}`)
  console.log('')

  const drive = await getDrive()
  const supabase = !DRY_RUN
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    : null

  console.log('▸ Recorriendo Drive…')
  const allFiles = await walkDrive(drive, ROOT_FOLDER_ID)
  console.log(`  ✓ ${allFiles.length} imágenes encontradas`)

  // Cargar registros existentes para detectar borrados
  const existingByDriveId = new Map()
  if (!DRY_RUN) {
    const { data, error } = await supabase
      .from('model_images')
      .select('id, drive_file_id, drive_modified_time')
    if (error) {
      console.error('❌ Error cargando model_images:', error.message)
      process.exit(1)
    }
    for (const r of (data || [])) {
      if (r.drive_file_id) existingByDriveId.set(r.drive_file_id, r)
    }
    console.log(`  ✓ ${existingByDriveId.size} registros en DB`)
  }

  let processed = 0, uploaded = 0, skipped = 0, archived = 0, unmatched = 0
  const seenInDrive = new Set()

  for (const { file, pathParts } of allFiles) {
    const ctx = inferFromPath(pathParts, file.name)
    seenInDrive.add(file.id)

    if (!ctx.linea) {
      unmatched++
      if (VERBOSE) console.log(`  ⚠ Sin línea: ${pathParts.join('/')}/${file.name}`)
      continue
    }

    if (LINE_FILTER && ctx.linea !== LINE_FILTER) continue

    const exists = existingByDriveId.get(file.id)
    if (exists && exists.drive_modified_time === file.modifiedTime) {
      skipped++
      continue
    }

    if (DRY_RUN) {
      processed++
      if (VERBOSE || processed <= 10) {
        console.log(`  → ${ctx.linea}/T${ctx.tipologia_code || '*'}/V${ctx.variante || '*'}/${ctx.style_name || '*'}/${ctx.sistema_constructivo || '*'} ${ctx.is_exterior ? 'EXT' : 'INT'}${ctx.room_type ? '/'+ctx.room_type : ''}: ${file.name}`)
      }
      continue
    }

    // ── Descarga + procesa imagen ─────────────────────────────────
    try {
      const buffer = await downloadFile(drive, file.id)

      // Storage path organizado
      const ext = mime.extension(file.mimeType) || 'jpg'
      const storagePath = [
        ctx.linea.toLowerCase(),
        ctx.tipologia_code ? `t${ctx.tipologia_code}` : 'all',
        ctx.style_name ? ctx.style_name.toLowerCase() : 'all',
        ctx.variante ? `v${ctx.variante}` : 'all',
        ctx.is_exterior ? 'ext' : 'int',
        ctx.room_type || '',
        `${file.id}.${ext}`,
      ].filter(Boolean).join('/')

      // Metadata + LQIP
      let width = null, height = null, lqipColor = '#e5e5e5'
      try {
        const meta = await sharp(buffer).metadata()
        width = meta.width
        height = meta.height
        // Color promedio del 1×1 downsample
        const tiny = await sharp(buffer).resize(1, 1).raw().toBuffer()
        if (tiny.length >= 3) {
          lqipColor = `#${tiny[0].toString(16).padStart(2,'0')}${tiny[1].toString(16).padStart(2,'0')}${tiny[2].toString(16).padStart(2,'0')}`
        }
      } catch {}

      const publicUrl = await uploadToStorage(supabase, storagePath, buffer, file.mimeType)

      const record = {
        linea: ctx.linea,
        tipologia_code: ctx.tipologia_code,
        style_name: ctx.style_name,
        variante: ctx.variante,
        sistema_constructivo: ctx.sistema_constructivo,
        is_exterior: ctx.is_exterior,
        room_type: ctx.room_type,
        sort_order: 0,
        storage_path: storagePath,
        storage_url: publicUrl,
        width, height, lqip_color: lqipColor,
        drive_file_id: file.id,
        drive_modified_time: file.modifiedTime,
        drive_path: pathParts.join('/'),
        status: 'active',
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('model_images')
        .upsert(record, { onConflict: 'drive_file_id' })

      if (error) throw error
      uploaded++
      if (VERBOSE) console.log(`  ✓ ${storagePath}`)
    } catch (err) {
      console.error(`  ❌ ${file.name}: ${err.message}`)
    }

    processed++
    if (processed % 20 === 0) console.log(`  … ${processed} procesados`)
  }

  // Archivar fotos que ya no están en Drive
  if (!DRY_RUN) {
    for (const [driveId, row] of existingByDriveId) {
      if (!seenInDrive.has(driveId)) {
        await supabase
          .from('model_images')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        archived++
      }
    }
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✓ Procesadas:   ${processed}`)
  console.log(`  ✓ Subidas:      ${uploaded}`)
  console.log(`  ⊙ Sin cambios:  ${skipped}`)
  console.log(`  ⊙ Archivadas:   ${archived}`)
  console.log(`  ⚠ Sin match:    ${unmatched}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
