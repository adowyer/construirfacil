/**
 * 12_cleanup_drive_local.mjs
 *
 * Limpia los residuos en `Catálogo HAUSIND®` después de correr el script 11:
 *
 *   1. Borra `Tipologia X/Planos/Casa <NOMBRE>/` que se crearon por error
 *      cuando el primer run movió PDFs de TECHOS hacia Planos.
 *   2. Borra `Tipologia X/Casa <NOMBRE>/{CARPINTERÍAS,PANELERÍA,TECHOS}/`
 *      (carpetas de detalles técnicos que NO van al catálogo).
 *   3. Si la `Casa <NOMBRE>/` queda vacía (o solo con `.DS_Store`), la borra.
 *
 * NO toca `Tipologia X/Planos/` (esa carpeta queda vacía, lista para
 * recibir los planos arquitectónicos cuando se carguen).
 *
 * Idempotente. Soporta `--dry-run`.
 *
 * Uso:
 *   node 12_cleanup_drive_local.mjs --dry-run
 *   node 12_cleanup_drive_local.mjs
 */

import { readdir, rm, rmdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'Catálogo HAUSIND®',
)

const DRY_RUN = process.argv.includes('--dry-run')

const DETAIL_FOLDERS_RE = /^(carpinter[íi]as?|paneler[íi]a|techos)$/i

let opCount = 0
function logOp(action, target) {
  opCount++
  console.log(`  ${action} ${target}`)
}

function nfc(s) {
  return s.normalize('NFC')
}

async function listDirs(path) {
  if (!existsSync(path)) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function listAll(path) {
  if (!existsSync(path)) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries
}

async function rmTree(path, label = 'RM') {
  if (!existsSync(path)) return
  logOp(label, path)
  if (!DRY_RUN) await rm(path, { recursive: true, force: true })
}

async function rmIfEmptyOrJustDS(path) {
  if (!existsSync(path)) return false
  const entries = await readdir(path)
  if (entries.length === 0) {
    logOp('RMDIR', path)
    if (!DRY_RUN) await rmdir(path)
    return true
  }
  if (entries.length === 1 && entries[0] === '.DS_Store') {
    logOp('RMDIR (solo .DS_Store)', path)
    if (!DRY_RUN) {
      await unlink(join(path, '.DS_Store'))
      await rmdir(path)
    }
    return true
  }
  return false
}

async function cleanupTipologia(tipPath) {
  // 1. Casa <NOMBRE>/{detalles}/ y borrar Casa si queda vacía
  for (const sub of await listDirs(tipPath)) {
    if (sub === 'AXONOMETRIAS' || sub === 'Planos' || sub === 'Renders') continue
    if (!/^casa\b/i.test(nfc(sub))) continue

    const casaPath = join(tipPath, sub)

    for (const inner of await listDirs(casaPath)) {
      if (DETAIL_FOLDERS_RE.test(nfc(inner))) {
        await rmTree(join(casaPath, inner), 'RM (detalle)')
      }
    }
    // Si la casa quedó vacía o solo con .DS_Store, borrar.
    await rmIfEmptyOrJustDS(casaPath)
  }

  // 2. Planos/Casa <NOMBRE>/ creadas por error (residuo del primer run)
  const planosPath = join(tipPath, 'Planos')
  if (existsSync(planosPath)) {
    for (const sub of await listDirs(planosPath)) {
      if (/^casa\b/i.test(nfc(sub))) {
        await rmTree(join(planosPath, sub), 'RM (planos/casa)')
      }
    }
  }
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no borra)' : 'EJECUTAR'}`)
  console.log(`Root: ${ROOT}\n`)

  if (!existsSync(ROOT)) {
    console.error(`❌ No existe la carpeta: ${ROOT}`)
    process.exit(1)
  }

  for (const linea of await listDirs(ROOT)) {
    const lineaPath = join(ROOT, linea)
    console.log(`━━ ${linea} ━━`)
    for (const tip of await listDirs(lineaPath)) {
      await cleanupTipologia(join(lineaPath, tip))
    }
  }

  console.log(`\n✓ ${opCount} operaciones ${DRY_RUN ? '(dry-run)' : 'aplicadas'}.`)
}

main().catch((err) => {
  console.error('❌ Excepción:', err)
  process.exit(1)
})
