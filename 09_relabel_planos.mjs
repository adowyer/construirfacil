/**
 * 09_relabel_planos.mjs
 *
 * Marca con image_type='plano' todas las filas de model_images cuyo
 * drive_path contenga la carpeta /Planos/ o /AXONOMETRIAS/ (case-insensitive,
 * por si en algún sub-folder cambia la capitalización).
 *
 * Idempotente: solo actualiza las filas cuyo image_type ya no es 'plano',
 * así se puede correr múltiples veces sin reescribir.
 *
 * Uso:
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_KEY=...
 *   node 09_relabel_planos.mjs           # ejecuta el UPDATE
 *   node 09_relabel_planos.mjs --dry-run # solo reporta, no escribe
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Cargar .env.local manualmente (Next.js lo lee solo, pero `node` no).
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
    // Pelar comillas simples o dobles.
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadDotenv('.env.local')
loadDotenv('.env')

// Aceptamos los nombres de env de Next (NEXT_PUBLIC_*) y los nombres de los
// scripts viejos (SUPABASE_URL / SUPABASE_SERVICE_KEY) — lo que esté primero.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan vars de Supabase en .env.local o el entorno.')
  console.error('   Necesito SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)')
  console.error('   y       SUPABASE_SERVICE_KEY (o SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// Match cualquier segmento del path llamado "Planos" o "AXONOMETRIAS",
// independientemente de mayúsculas/minúsculas.
const PLANOS_RE = /(^|\/)(planos|axonometrias)(\/|$)/i

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'EJECUTAR UPDATE'}`)
  console.log('Buscando model_images con drive_path en /Planos/ o /AXONOMETRIAS/…\n')

  const { data, error } = await supabase
    .from('model_images')
    .select('id, drive_path, image_type, view_label')
    .neq('status', 'archived')

  if (error) {
    console.error('❌ Error leyendo model_images:', error.message)
    process.exit(1)
  }

  const all = data ?? []
  console.log(`Total filas activas: ${all.length}`)

  const candidates = all.filter((r) => r.drive_path && PLANOS_RE.test(r.drive_path))
  console.log(`Coincidencias en path: ${candidates.length}`)

  const toUpdate = candidates.filter((r) => r.image_type !== 'plano')
  console.log(`A actualizar (image_type ≠ 'plano'): ${toUpdate.length}`)

  if (toUpdate.length === 0) {
    console.log('\nNada para actualizar. Listo.')
    return
  }

  // Sample para verificar qué se va a actualizar.
  console.log('\nMuestra (primeras 5):')
  for (const r of toUpdate.slice(0, 5)) {
    console.log(`  ${r.drive_path}  [${r.image_type ?? 'null'} → plano]`)
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no se ejecutó el UPDATE.')
    return
  }

  const ids = toUpdate.map((r) => r.id)
  const { error: updError } = await supabase
    .from('model_images')
    .update({ image_type: 'plano' })
    .in('id', ids)

  if (updError) {
    console.error('❌ Error en UPDATE:', updError.message)
    process.exit(1)
  }

  console.log(`\n✓ ${ids.length} filas marcadas como image_type='plano'.`)
}

main().catch((err) => {
  console.error('❌ Excepción:', err)
  process.exit(1)
})
