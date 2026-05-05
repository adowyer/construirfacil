/**
 * 11_normalize_drive_local.mjs
 *
 * Normaliza la estructura local de `Catálogo HAUSIND®` para que matchee
 * con la convención unificada de Bosque. Después de correrlo, todas las
 * líneas tienen exactamente:
 *
 *   LINEA <NOMBRE>/
 *     Tipologia <CODE>/
 *       AXONOMETRIAS/
 *       Planos/
 *       Renders/
 *         EXTERIORES/
 *           Casa <NOMBRE>/   (contenido suelto o con subcarpetas Variante N)
 *         INTERIORES/
 *           Casa <NOMBRE>/
 *
 * Operaciones idempotentes: si una ruta ya está bien, no se toca.
 *
 * Uso:
 *   node 11_normalize_drive_local.mjs --dry-run    # solo simula
 *   node 11_normalize_drive_local.mjs              # ejecuta los rename/move
 *
 * Después de correrlo, subís la carpeta normalizada al Drive (reemplazando
 * la actual) y corrés `04_sync_drive_photos.mjs` para reimportar.
 */

import { readdir, rename, mkdir, rmdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'Catálogo HAUSIND®',
)

const DRY_RUN = process.argv.includes('--dry-run')

const ops = []
function logOp(action, from, to = null) {
  const entry = to ? `${action} ${from}  →  ${to}` : `${action} ${from}`
  ops.push(entry)
  console.log(`  ${entry}`)
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

async function listDirs(path) {
  if (!existsSync(path)) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function listFiles(path) {
  if (!existsSync(path)) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => e.name)
}

async function ensureDir(path) {
  if (existsSync(path)) return false
  logOp('MKDIR', path)
  if (!DRY_RUN) await mkdir(path, { recursive: true })
  return true
}

// "Tipología" vs "Tipologia" son distintos como strings, pero APFS los
// trata como el mismo path. Para detectar este caso comparamos sin
// diacríticos y sin case.
function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function renameIfNeeded(from, to) {
  if (from === to) return
  if (!existsSync(from)) return

  // Si la diferencia entre from y to es solo capitalización y/o tildes,
  // los dos paths resuelven al MISMO inode en disco. Forzamos el cambio
  // del nombre canónico vía rename intermedio (a un nombre temporal).
  const sameSemantically =
    stripAccents(from).toLowerCase() === stripAccents(to).toLowerCase()
  if (sameSemantically) {
    logOp('RENAME (case/accent)', from, to)
    if (!DRY_RUN) {
      const tmp = `${from}__TMP_${Date.now()}__`
      await rename(from, tmp)
      await rename(tmp, to)
    }
    return
  }

  if (existsSync(to)) {
    // Destino existe con otro contenido real: mover y borrar el vacío.
    return moveContent(from, to, true)
  }
  logOp('RENAME', from, to)
  if (!DRY_RUN) await rename(from, to)
}

async function moveContent(from, to, deleteSrcWhenEmpty = false) {
  if (!existsSync(from)) return
  await ensureDir(to)
  const entries = await readdir(from, { withFileTypes: true })
  for (const entry of entries) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (existsSync(dst)) {
      if (entry.isDirectory()) {
        await moveContent(src, dst, true)
      } else {
        // Archivo ya existe en destino: skip (no sobreescribimos).
        logOp('SKIP (existe)', dst)
      }
    } else {
      logOp('MOVE', src, dst)
      if (!DRY_RUN) await rename(src, dst)
    }
  }
  if (deleteSrcWhenEmpty) {
    if (!DRY_RUN) {
      try {
        const remaining = await readdir(from)
        if (remaining.length === 0) await rmdir(from)
      } catch {}
    } else {
      logOp('RMDIR (si vacío)', from)
    }
  }
}

// Reglas de renombrado. macOS APFS guarda paths con acentos en NFD
// (decomposed: 'í' = 'i' + '́'). Normalizamos cada candidato a NFC
// antes de matchear regex con caracteres precompuestos.
function nfc(s) {
  return s.normalize('NFC')
}

function normalizedLineaName(name) {
  const m = nfc(name).match(/^l[ií]nea\s+(\w+)/i)
  if (!m) return null
  return `LINEA ${m[1].toUpperCase()}`
}

function normalizedTipologiaName(name) {
  const norm = nfc(name)
  const m = norm.match(/^tipolog[ií]a\s+(\S+)/i)
  if (!m) return null
  const code = m[1].toUpperCase()
  const paren = norm.match(/\(.*\)/)
  return paren ? `Tipologia ${code} ${paren[0]}` : `Tipologia ${code}`
}

function normalizedRendersName(name) {
  if (/^renders$/i.test(nfc(name))) return 'Renders'
  return null
}

function normalizedExterioresName(name) {
  if (/^exteriores?$/i.test(nfc(name))) return 'EXTERIORES'
  return null
}

function normalizedInterioresName(name) {
  if (/^interiores?$/i.test(nfc(name))) return 'INTERIORES'
  return null
}

function normalizedAxosName(name) {
  const n = nfc(name)
  if (/^axonometr[ií]?cas?$/i.test(n)) return 'AXONOMETRIAS'
  if (/^axonometr[ií]as?$/i.test(n)) return 'AXONOMETRIAS'
  return null
}

function normalizedPlanosName(name) {
  if (/^planos?$/i.test(nfc(name))) return 'Planos'
  return null
}

function ensureCasaPrefix(name) {
  // Si ya tiene "Casa " adelante, dejar igual.
  if (/^casa\b/i.test(name)) return name
  // Solo agregamos el prefijo si el nombre parece nombre propio de casa:
  //   - todo en MAYÚSCULAS (ej. CALIFORNIA, MAHUIDA), o
  //   - empieza con mayúscula y la primera palabra es ALL CAPS (ej.
  //     "PAMPA campestre", aunque acá ya viene como "Casa PAMPA (campestre)").
  // Esto descarta carpetas tipo "Aberturas en madera" que NO son modelos.
  const firstWord = name.split(/\s+/)[0]
  if (firstWord === firstWord.toUpperCase() && /^[A-ZÁÉÍÓÚÑ]+$/.test(firstWord)) {
    return `Casa ${name}`
  }
  return name
}

function ensureVariantePrefix(name) {
  // Si ya empieza con "Variante", lo dejamos.
  if (/^variante\b/i.test(name)) return name
  // Si es solo un número, lo prefijamos.
  if (/^\d+(\.\d+)?$/.test(name)) return `Variante ${name}`
  return name
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline por tipología
// ─────────────────────────────────────────────────────────────────────────

async function normalizeTipologia(lineaPath, tipName) {
  const newTipName = normalizedTipologiaName(tipName)
  if (newTipName && newTipName !== tipName) {
    const oldPath = join(lineaPath, tipName)
    const newPath = join(lineaPath, newTipName)
    await renameIfNeeded(oldPath, newPath)
    tipName = newTipName
  }
  const tipPath = join(lineaPath, tipName)

  // 1. Asegurar carpetas hermanas requeridas: AXONOMETRIAS, Planos, Renders
  await ensureDir(join(tipPath, 'AXONOMETRIAS'))
  await ensureDir(join(tipPath, 'Planos'))
  await ensureDir(join(tipPath, 'Renders'))
  await ensureDir(join(tipPath, 'Renders', 'EXTERIORES'))
  await ensureDir(join(tipPath, 'Renders', 'INTERIORES'))

  // 2. Renombrar variantes existentes (Renders, EXTERIORES, etc.) si tienen
  //    capitalización distinta. Si existe RENDERS y Renders, vamos a fusionar.
  const subdirs = await listDirs(tipPath)
  for (const sub of subdirs) {
    const subPath = join(tipPath, sub)
    if (sub === 'AXONOMETRIAS' || sub === 'Planos' || sub === 'Renders') continue

    // Otras axos (AXONOMETRICAS, etc.)
    const axoNorm = normalizedAxosName(sub)
    if (axoNorm) {
      await moveContent(subPath, join(tipPath, axoNorm), true)
      continue
    }

    // Otros planos
    const planosNorm = normalizedPlanosName(sub)
    if (planosNorm) {
      await moveContent(subPath, join(tipPath, planosNorm), true)
      continue
    }

    // RENDERS (mayús) → Renders
    const rendersNorm = normalizedRendersName(sub)
    if (rendersNorm) {
      await moveContent(subPath, join(tipPath, rendersNorm), true)
      continue
    }

    // Carpeta de "Casa X" en el nivel de tipología (estructura Atlas):
    //   Tipologia N/Casa CALIFORNIA/RENDERS/EXTERIORES/*
    // → Tipologia N/Renders/EXTERIORES/Casa CALIFORNIA/*
    if (/^casa\b/i.test(sub) || /^[A-Z]{3,}/.test(sub)) {
      const casaName = ensureCasaPrefix(sub)
      await migrateAtlasCasa(tipPath, sub, casaName)
      continue
    }
  }

  // 3. Procesar Renders/EXTERIORES y INTERIORES — normalizar carpetas internas.
  for (const where of ['EXTERIORES', 'INTERIORES']) {
    const dirPath = join(tipPath, 'Renders', where)
    if (!existsSync(dirPath)) continue
    const inner = await listDirs(dirPath)
    for (const item of inner) {
      const oldPath = join(dirPath, item)
      const casaName = ensureCasaPrefix(item)
      if (casaName !== item) {
        const newPath = join(dirPath, casaName)
        await renameIfNeeded(oldPath, newPath)
      }
      // Adentro de la casa: renombrar variantes numéricas a "Variante N"
      const casaPath = join(dirPath, casaName)
      const innerVar = await listDirs(casaPath)
      for (const v of innerVar) {
        const newV = ensureVariantePrefix(v)
        if (newV !== v) {
          await renameIfNeeded(join(casaPath, v), join(casaPath, newV))
        }
      }
    }
  }
}

// Subcarpetas técnicas de Atlas (CARPINTERÍAS, PANELERÍA, TECHOS) que
// contienen PDFs de detalles arquitectónicos. NO las tocamos: quedan
// donde están dentro de cada Casa X. El user decide después qué hacer.

// Caso especial Atlas: Tipologia N/Casa X/{RENDERS,CARPINTERÍAS,PANELERÍA,TECHOS}/...
async function migrateAtlasCasa(tipPath, oldCasaSubname, casaName) {
  const casaSrc = join(tipPath, oldCasaSubname)
  const insideCasa = await listDirs(casaSrc)

  for (const r of insideCasa) {
    const rPath = join(casaSrc, r)

    // Renders → mover a Renders/EXTERIORES|INTERIORES/Casa X/...
    if (normalizedRendersName(r)) {
      const sections = await listDirs(rPath)
      for (const sec of sections) {
        const dest =
          normalizedExterioresName(sec) ?? normalizedInterioresName(sec)
        if (!dest) continue
        const srcSec = join(rPath, sec)
        const dstSec = join(tipPath, 'Renders', dest, casaName)
        await ensureDir(dstSec)
        await moveContent(srcSec, dstSec, true)
      }
      if (!DRY_RUN) {
        try {
          const remaining = await readdir(rPath)
          if (remaining.length === 0) await rmdir(rPath)
        } catch {}
      }
      continue
    }

    // CARPINTERÍAS / PANELERÍA / TECHOS y otras subcarpetas técnicas:
    // las dejamos en su lugar. No las movemos.
  }

  // Archivos sueltos en Casa X (sin subcarpeta) → Renders/EXTERIORES/Casa X/.
  if (existsSync(casaSrc)) {
    const remaining = await readdir(casaSrc, { withFileTypes: true })
    const looseFiles = remaining.filter((e) => e.isFile()).map((e) => e.name)
    if (looseFiles.length > 0) {
      const dst = join(tipPath, 'Renders', 'EXTERIORES', casaName)
      await ensureDir(dst)
      for (const f of looseFiles) {
        const from = join(casaSrc, f)
        const to = join(dst, f)
        if (existsSync(to)) {
          logOp('SKIP (existe)', to)
        } else {
          logOp('MOVE', from, to)
          if (!DRY_RUN) await rename(from, to)
        }
      }
    }
    if (!DRY_RUN) {
      try {
        const remaining2 = await readdir(casaSrc)
        if (remaining2.length === 0) await rmdir(casaSrc)
      } catch {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline por línea
// ─────────────────────────────────────────────────────────────────────────

async function normalizeLinea(rootPath, lineaName) {
  const newLineaName = normalizedLineaName(lineaName)
  if (newLineaName && newLineaName !== lineaName) {
    const oldPath = join(rootPath, lineaName)
    const newPath = join(rootPath, newLineaName)
    await renameIfNeeded(oldPath, newPath)
    lineaName = newLineaName
  }
  const lineaPath = join(rootPath, lineaName)
  const tipologias = await listDirs(lineaPath)
  for (const t of tipologias) {
    await normalizeTipologia(lineaPath, t)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no toca archivos)' : 'EJECUTAR'}`)
  console.log(`Root: ${ROOT}\n`)

  if (!existsSync(ROOT)) {
    console.error(`❌ No existe la carpeta: ${ROOT}`)
    process.exit(1)
  }

  const lineas = await listDirs(ROOT)
  for (const l of lineas) {
    console.log(`\n━━ ${l} ━━`)
    await normalizeLinea(ROOT, l)
  }

  console.log(`\n\n✓ ${ops.length} operaciones ${DRY_RUN ? '(dry-run, no aplicadas)' : 'aplicadas'}.`)
}

main().catch((err) => {
  console.error('❌ Excepción:', err)
  process.exit(1)
})
