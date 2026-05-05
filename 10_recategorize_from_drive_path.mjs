/**
 * 10_recategorize_from_drive_path.mjs
 *
 * Re-categoriza las imágenes ya cargadas en `model_images` ajustando
 * `is_exterior` e `image_type` a partir de su `drive_path`. Útil cuando
 * el Drive está bien organizado por carpetas (EXTERIOR / INTERIOR /
 * Planos / AXONOMETRICAS) pero la DB las tiene mal categorizadas porque
 * el sync original no leía esas carpetas.
 *
 * Reglas (case-insensitive, en cualquier segmento del path):
 *   /Planos/ o /Plano/                                 → image_type='plano', is_exterior=false
 *   /AXONOMETRICAS/ o /AXONOMETRIAS/                   → image_type='plano', is_exterior=false
 *   /EXTERIOR(ES)?/                                    → is_exterior=true,  image_type='render'
 *   /INTERIOR(ES)?/                                    → is_exterior=false, image_type='render'
 *
 * Si el path no matchea ninguna carpeta conocida, no se toca.
 *
 * Idempotente: solo actualiza filas donde los valores nuevos difieren
 * de los actuales.
 *
 * Uso:
 *   export SUPABASE_URL=... SUPABASE_SERVICE_KEY=...
 *   node 10_recategorize_from_drive_path.mjs --dry-run
 *   node 10_recategorize_from_drive_path.mjs
 *
 * Lee `.env.local` automáticamente si existe.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── Cargar .env.local manualmente (Next.js lo lee solo, `node` no) ──────
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── Reglas ──────────────────────────────────────────────────────────────
// Cada regla mira si el path contiene un segmento con el nombre dado,
// y devuelve los campos que hay que setear si matchea.
//
// Orden importa: planos/axos primero, después interior, después exterior.
// Así una foto en /EXTERIOR/Planos/ queda como plano (no como exterior).
const RULES = [
  {
    re: /(^|\/)(planos?|axonometricas?|axonometrias?)(\/|$)/i,
    fields: { image_type: 'plano', is_exterior: false },
    label: 'plano/axonometría',
  },
  {
    re: /(^|\/)interiores?(\/|$)/i,
    fields: { image_type: 'render', is_exterior: false },
    label: 'interior',
  },
  {
    re: /(^|\/)exteriores?(\/|$)/i,
    fields: { image_type: 'render', is_exterior: true },
    label: 'exterior',
  },
]

function classify(drivePath) {
  if (!drivePath) return null
  for (const rule of RULES) {
    if (rule.re.test(drivePath)) return rule
  }
  return null
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'EJECUTAR UPDATE'}\n`)

  // 1. Traer todas las imágenes activas con su path y estado actual.
  const { data, error } = await supabase
    .from('model_images')
    .select('id, drive_path, is_exterior, image_type')
    .neq('status', 'archived')

  if (error) {
    console.error('❌ Error leyendo model_images:', error.message)
    process.exit(1)
  }

  const all = data ?? []
  console.log(`Total filas activas: ${all.length}\n`)

  // 2. Clasificar cada una y decidir si hay que actualizar.
  const stats = { plano: 0, interior: 0, exterior: 0, unmatched: 0, ok: 0 }
  const toUpdate = []

  for (const row of all) {
    const rule = classify(row.drive_path)
    if (!rule) {
      stats.unmatched++
      continue
    }
    const newType = rule.fields.image_type
    const newExt = rule.fields.is_exterior
    const needsUpdate =
      row.image_type !== newType || row.is_exterior !== newExt
    if (needsUpdate) {
      toUpdate.push({ id: row.id, fields: rule.fields, drive_path: row.drive_path, label: rule.label })
      if (rule.fields.image_type === 'plano') stats.plano++
      else if (rule.fields.is_exterior) stats.exterior++
      else stats.interior++
    } else {
      stats.ok++
    }
  }

  console.log('Resumen:')
  console.log(`  Ya OK:                ${stats.ok}`)
  console.log(`  A marcar plano/axo:   ${stats.plano}`)
  console.log(`  A marcar interior:    ${stats.interior}`)
  console.log(`  A marcar exterior:    ${stats.exterior}`)
  console.log(`  Sin matchear (skip):  ${stats.unmatched}`)
  console.log(`  Total a actualizar:   ${toUpdate.length}`)

  if (toUpdate.length === 0) {
    console.log('\nNada para actualizar. Listo.')
    return
  }

  console.log('\nMuestra (primeras 10):')
  for (const u of toUpdate.slice(0, 10)) {
    console.log(`  [${u.label}]  ${u.drive_path}`)
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no se ejecutó el UPDATE.')
    return
  }

  // 3. Ejecutar updates en chunks (para evitar payloads gigantes).
  const CHUNK = 100
  let done = 0
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)

    // Un UPDATE por fila (los campos pueden variar). En 339 filas es
    // razonable; si crece mucho, agrupamos por (image_type, is_exterior).
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from('model_images')
          .update(u.fields)
          .eq('id', u.id)
          .then(({ error: e }) => {
            if (e) console.error(`  ❌ ${u.id}: ${e.message}`)
          }),
      ),
    )

    done += chunk.length
    if (toUpdate.length > CHUNK) {
      console.log(`  … ${done} / ${toUpdate.length}`)
    }
  }

  console.log(`\n✓ ${toUpdate.length} filas actualizadas.`)
}

main().catch((err) => {
  console.error('❌ Excepción:', err)
  process.exit(1)
})
