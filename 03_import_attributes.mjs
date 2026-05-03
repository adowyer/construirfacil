/**
 * 03_import_attributes.mjs
 * ----------------------------------------------------------------------------
 * Importa los atributos del CSV (exportado de WordPress) a las tablas:
 *   • attribute_types  (26 tipos)
 *   • attribute_values (~587 valores)
 *
 * El CSV tiene 3 columnas:
 *   1. Nombre (con sufijos basura "Editar | Eliminar" del export)
 *   2. Slug
 *   3. Lista de valores separados por coma, con sufijo "Configurar términos"
 *
 * USO:
 *   1. npm install csv-parse @supabase/supabase-js
 *   2. Poner el CSV en ./data/atributos.csv
 *   3. export SUPABASE_URL=...; export SUPABASE_SERVICE_KEY=...
 *   4. node 03_import_attributes.mjs
 *
 * Modos:
 *   --dry-run  : muestra lo que importaría sin escribir
 *   --verbose  : log detallado
 * ----------------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fs from 'node:fs'
import path from 'node:path'

const CSV_PATH = process.env.CSV_PATH || path.resolve('./data/atributos.csv')

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// Tipos redundantes con columnas fijas de house_catalog (o data placeholder de WP).
// Se saltean al importar — ver tabla en CLAUDE/refactor plan.
const SKIP_SLUGS = new Set([
  'dorm',                  // duplica min_bedrooms/max_bedrooms/bedrooms_label
  'banos',                 // duplica bathrooms
  'toilette',              // duplica columna toilette (boolean)
  'estilos',               // duplica columna estilo
  'sistema-constructivo',  // duplica columna sistema_constructivo
  'plantas',               // duplica columna floors
  'size',                  // duplica area_m2
  'superficie-cubierta',   // duplica area_m2 (además 1 valor basura)
  'color',                 // valores WP dummy
])

// Subcategorías auto-detectadas que son ruido del CSV (modificadores
// repetidos, fragmentos de paréntesis huérfanos). Se descartan: las
// "variantes" vuelven al pool de orphans del tipo padre.
const SKIP_SUBTYPE_NAMES = new Set([
  'acero inoxidable',                       // suffix de heladera
  'Alta Recuperación',                       // suffix de termotanque
  'u. o global) Coeficiente MO ≈ 0',        // fragmento de paréntesis
])

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  console.error('❌ Configurá SUPABASE_URL y SUPABASE_SERVICE_KEY (o usá --dry-run).')
  process.exit(1)
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ No se encontró el CSV en: ${CSV_PATH}`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza
// ─────────────────────────────────────────────────────────────────────────────

/** Quita sufijo "Editar | Eliminar" del export de WP */
function cleanTypeName(name) {
  return String(name)
    .replace(/Editar\s*\|\s*Eliminar\s*$/i, '')
    .replace(/Editar\.{3}Eliminar\s*$/i, '')
    .trim()
}

/** Limpia la lista de valores: quita "Configurar términos" y splitea por coma */
function parseValues(raw) {
  if (!raw || raw === '–' || raw === '-') return []
  const cleaned = String(raw)
    .replace(/\s*Configurar términos\s*$/im, '')
    .replace(/\s*Configurar terminos\s*$/im, '')
    .trim()
  if (!cleaned) return []
  return cleaned
    .split(/,\s*/)
    .map(v => v.trim())
    .filter(v => v.length > 0)
}

/** Genera un slug a partir de un valor */
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing del CSV
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows = parse(content, {
    columns: false,
    skip_empty_lines: true,
    relax_quotes: true,
  })

  const types = []
  for (const row of rows) {
    if (row.length < 3) continue
    const name = cleanTypeName(row[0])
    const slug = String(row[1]).trim()
    const values = parseValues(row[2])
    if (!name || !slug) continue
    types.push({ name, slug, values })
  }

  // Dedup por slug + saltear tipos redundantes con columnas fijas
  const seen = new Set()
  const dedupped = []
  let skipped = 0
  for (const t of types) {
    if (seen.has(t.slug)) continue
    seen.add(t.slug)
    if (SKIP_SLUGS.has(t.slug)) {
      skipped++
      continue
    }
    dedupped.push(t)
  }
  if (skipped > 0) {
    console.log(`▸ ${skipped} tipos salteados por solaparse con columnas fijas`)
  }

  // Expandir subcategorías detectadas (ver detectSubtypes).
  const expanded = []
  let subtypeCount = 0
  for (const t of dedupped) {
    const { subtypes, orphanValues } = detectSubtypes(t.values)
    if (subtypes.size === 0) {
      expanded.push(t)
      continue
    }
    // El tipo padre conserva los huérfanos.
    expanded.push({ ...t, values: orphanValues, _parentOf: subtypes.size })
    // Cada subcategoría se promueve a tipo top-level.
    for (const [subName, variants] of subtypes) {
      subtypeCount++
      expanded.push({
        name: subName,
        slug: subtypeSlug(t.slug, subName),
        values: variants,
        _derivedFrom: t.slug,
      })
    }
  }
  if (subtypeCount > 0) {
    console.log(`▸ ${subtypeCount} subcategorías detectadas y promovidas`)
  }

  return expanded
}

// ─────────────────────────────────────────────────────────────────────────────
// Detección de subcategorías
// ─────────────────────────────────────────────────────────────────────────────
//
// El CSV de WP guardó algunos términos con coma interna (ej: "Calefacción,
// Estufa Catalítica" como UN solo término). Al hacer split por coma se
// rompen en fragmentos sueltos: ["Calefacción", "Estufa Catalítica",
// "Calefacción", "Estufa Infraroja", ...].
//
// Heurística: si un token aparece N≥2 veces y siempre va seguido por otro
// token distinto, lo tratamos como sub-categoría: creamos un attribute_type
// nuevo con ese nombre y los tokens que le siguen se vuelven sus valores.
//
// Los tokens "huérfanos" (sin patrón) quedan como valores del tipo original.

/** Heurística: ¿el nombre del candidato luce como una categoría real? */
function looksLikeCategory(name) {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 6) return false
  // Mayoría de dígitos / símbolos = ruido (ej. "50 – 0", "60").
  const alpha = (trimmed.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) ?? []).length
  if (alpha < 4) return false
  // Si es una sola palabra muy corta, descartamos (ej. "60" no, "Calefacción" sí).
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 1 && trimmed.length < 8) return false
  return true
}

function detectSubtypes(values) {
  // Contar ocurrencias.
  const counts = new Map()
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))

  // Candidatos: tokens que aparecen ≥2 veces y lucen como categoría.
  // Validación: cada ocurrencia debe ir seguida de OTRO token distinto del candidato.
  const subtypeNames = new Set()
  for (const [name, count] of counts) {
    if (count < 2) continue
    if (!looksLikeCategory(name)) continue
    let valid = true
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== name) continue
      const next = values[i + 1]
      if (next === undefined || next === name) {
        valid = false
        break
      }
    }
    if (valid) subtypeNames.add(name)
  }

  // Pase secuencial: cada subtype name consume el token siguiente como variante.
  // Si el siguiente token también está en subtypeNames, NO lo consumimos
  // (evita encadenar y robar variantes a otros subtypes).
  const subtypes = new Map()
  const orphanValues = []
  for (let i = 0; i < values.length; i++) {
    const cur = values[i]
    if (subtypeNames.has(cur)) {
      const variant = values[i + 1]
      if (variant !== undefined && !subtypeNames.has(variant)) {
        if (!subtypes.has(cur)) subtypes.set(cur, [])
        subtypes.get(cur).push(variant)
        i++  // consumimos la variante
      } else {
        // Sin variante limpia → tratar el cur como orphan.
        orphanValues.push(cur)
      }
    } else {
      orphanValues.push(cur)
    }
  }

  // Filtro final: descartar subtypes con menos de 2 variantes (ruido)
  // y los explícitamente vetados en SKIP_SUBTYPE_NAMES.
  for (const [name, variants] of subtypes) {
    if (variants.length < 2 || SKIP_SUBTYPE_NAMES.has(name)) {
      subtypes.delete(name)
      orphanValues.push(name, ...variants)
    }
  }

  return { subtypes, orphanValues }
}

/** Genera un slug para un tipo derivado (sub-categoría) */
function subtypeSlug(parentSlug, subtypeName) {
  return `${parentSlug}-${slugify(subtypeName)}`.slice(0, 80)
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación
// ─────────────────────────────────────────────────────────────────────────────

async function importToSupabase(types) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  let typesUpserted = 0
  let valuesUpserted = 0
  const errors = []

  for (const t of types) {
    // 1) Upsert del tipo
    const { data: typeRow, error: typeErr } = await supabase
      .from('attribute_types')
      .upsert({ name: t.name, slug: t.slug }, { onConflict: 'slug' })
      .select('id, slug')
      .single()

    if (typeErr) {
      errors.push({ type: t.slug, error: typeErr.message })
      console.error(`  ❌ Tipo "${t.slug}": ${typeErr.message}`)
      continue
    }

    typesUpserted++
    if (VERBOSE) console.log(`  ✓ Tipo: ${t.name} (${t.values.length} valores)`)

    // 2) Upsert de cada valor
    // Schema real: attribute_values(id, attribute_type_id, name, slug,
    //   description, sort_order, pending_review, created_by, ...).
    if (t.values.length === 0) continue

    // Dedup por slug dentro del mismo batch — el CSV de WP a veces fragmenta
    // valores con coma interna (ej "Calefacción, Estufa Catalítica" se parte
    // en 2). Postgres rechaza el upsert si hay slugs repetidos en el batch.
    const dedup = new Map()
    let dropped = 0
    t.values.forEach((v, idx) => {
      const slug = slugify(v)
      if (!slug || dedup.has(slug)) {
        if (slug && dedup.has(slug)) dropped++
        return
      }
      dedup.set(slug, {
        attribute_type_id: typeRow.id,
        name: v,
        slug,
        sort_order: idx,
        pending_review: false,
      })
    })
    const valueRows = [...dedup.values()]
    if (dropped > 0 && VERBOSE) {
      console.log(`     ⚠ ${dropped} duplicados de slug salteados en "${t.slug}"`)
    }

    const { data: valData, error: valErr } = await supabase
      .from('attribute_values')
      .upsert(valueRows, { onConflict: 'attribute_type_id,slug' })
      .select('id')

    if (valErr) {
      errors.push({ type: t.slug, error: valErr.message })
      console.error(`  ❌ Valores de "${t.slug}": ${valErr.message}`)
    } else {
      valuesUpserted += valData?.length || 0
    }
  }

  return { typesUpserted, valuesUpserted, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Import de atributos (WordPress → Supabase)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  CSV:    ${CSV_PATH}`)
  console.log(`  Modo:   ${DRY_RUN ? 'DRY RUN' : 'PROD'}`)
  console.log('')

  const types = parseCsv()

  console.log(`▸ ${types.length} tipos parseados`)
  let totalValues = 0
  for (const t of types) {
    totalValues += t.values.length
    if (VERBOSE) console.log(`     ${t.slug.padEnd(35)} (${t.values.length})`)
  }
  console.log(`▸ ${totalValues} valores totales`)

  if (DRY_RUN) {
    console.log('')
    // Subtipos detectados (los que tienen _derivedFrom)
    const subtypes = types.filter(t => t._derivedFrom)
    if (subtypes.length > 0) {
      console.log('  Subcategorías detectadas:')
      for (const t of subtypes) {
        console.log(`     ${t.name} (${t.values.length} variantes) ← ${t._derivedFrom}`)
        t.values.forEach(v => console.log(`        - ${v}`))
      }
      console.log('')
    }
    console.log('  Primeros 3 tipos top-level:')
    types.filter(t => !t._derivedFrom).slice(0, 3).forEach(t => {
      console.log(`     ${t.name} (${t.slug}):`)
      t.values.slice(0, 5).forEach(v => console.log(`        - ${v}`))
      if (t.values.length > 5) console.log(`        … +${t.values.length - 5} más`)
    })
    return
  }

  console.log('')
  console.log('▸ Escribiendo a Supabase…')
  const { typesUpserted, valuesUpserted, errors } = await importToSupabase(types)

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✓ Tipos:    ${typesUpserted}/${types.length}`)
  console.log(`  ✓ Valores:  ${valuesUpserted}/${totalValues}`)
  console.log(`  ❌ Errores:  ${errors.length}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (errors.length) {
    console.log('')
    console.log('Errores:')
    errors.forEach(e => console.log(`   ${e.type}: ${e.error}`))
    process.exit(1)
  }
}

main().catch(err => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
