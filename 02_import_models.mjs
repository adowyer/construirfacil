/**
 * 02_import_models.mjs
 * ----------------------------------------------------------------------------
 * Importa los modelos del Excel "Cost_Models_Catalog_HAUSIND-27-04.xlsx"
 * a la tabla house_catalog.
 *
 * • Parsea el sheet "SUPERFICIES COSTOS OK"
 * • Limpia datos sucios (fechas mal formateadas, espacios extras, #REF!, $ y comas en precios)
 * • Limpia sufijos romanos (I, II, III) del nombre comercial
 * • Soporta subvariantes (3.1 → V3_1)
 * • Genera SKUs según la convención: {LINEA}-T{TIP}-V{VAR}-{NOMBRE}-{SC}-{M2}
 * • UPSERT por sku (idempotente: se puede correr múltiples veces)
 *
 * USO:
 *   1. npm install xlsx @supabase/supabase-js
 *   2. Poner el Excel en ./data/Cost_Models_Catalog_HAUSIND-27-04.xlsx
 *   3. Configurar variables de entorno:
 *        export SUPABASE_URL="https://xxx.supabase.co"
 *        export SUPABASE_SERVICE_KEY="eyJ..."
 *   4. node --env-file=.env 02_import_models.mjs
 *
 * Modos:
 *   --dry-run     : muestra lo que importaría sin escribir en DB
 *   --verbose     : log detallado por fila
 * ----------------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import path from 'node:path'
import fs from 'node:fs'

const EXCEL_PATH = process.env.EXCEL_PATH ||
  path.resolve('./data/Cost_Models_Catalog_HAUSIND-27-04.xlsx')
const SHEET_NAME = 'SUPERFICIES COSTOS OK'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  console.error('❌ Configurá SUPABASE_URL y SUPABASE_SERVICE_KEY (o usá --dry-run).')
  process.exit(1)
}

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`❌ No se encontró el Excel en: ${EXCEL_PATH}`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeos
// ─────────────────────────────────────────────────────────────────────────────

const LINEA_CODE = {
  BOSQUE: 'HB',
  ATLAS:  'HA',
  TERRA:  'HT',
}

const SISTEMA_CODE = {
  'WOOD PLUS':     'WP',
  'STEEL PLUS':    'SP',
  'HORMIGÓN PLUS': 'HP',
  'HORMIGON PLUS': 'HP',
}

const ESTILO_NORMALIZADO = {
  'Moderno':      'Moderno',
  'Campestre':    'Campestre',
  'Industrial':   'Industrial',
  'Nórdico':      'Nórdico',
  'Nordico':      'Nórdico',
  'Chalet':       'Chalet',
  'Mediterráneo': 'Mediterráneo',
  'Mediterraneo': 'Mediterráneo',
  'Clásico':      'Clásico',
  'Clasico':      'Clásico',
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(s) {
  let n = String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
  n = n.replace(/(III|II|I)$/, '')
  return n
}

function padArea(m2) {
  const n = Math.round(Number(m2))
  return String(n).padStart(3, '0')
}

function parseBedrooms(label) {
  if (label == null || label === '' || label === '-') return { min: null, max: null }
  const s = String(label).trim()
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/)
  if (range) return { min: +range[1], max: +range[2] }
  const list = s.match(/(\d+)/g)
  if (list && list.length > 0) {
    const nums = list.map(Number)
    return { min: Math.min(...nums), max: Math.max(...nums) }
  }
  return { min: null, max: null }
}

function unmangleExcelDate(v, fieldName) {
  if (v instanceof Date) {
    const m = v.getMonth() + 1
    const d = v.getDate()
    const y = v.getFullYear()
    if (y === 1900 && m === 1) return String(d)
    if (y >= 2024) return `${d}.${m}`
    if (VERBOSE) console.warn(`  ⚠ fecha inesperada en ${fieldName}: ${v.toISOString()}`)
    return null
  }
  return v
}

/**
 * Convierte un valor a número.
 * Maneja:
 *   - null/undefined/'' → null
 *   - '-' → null
 *   - '#REF!' → null
 *   - '$207,625' → 207625
 *   - '1.581,00' → 1581 (formato europeo)
 *   - '1,581.00' → 1581 (formato US)
 *   - 207625 → 207625
 */
function toNumber(v) {
  if (v == null || v === '' || v === '-') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null

  let s = String(v).trim()
  if (s === '' || s === '-') return null
  if (s.includes('#REF') || s.includes('#N/A') || s.includes('#VALUE')) return null

  // Quitar símbolos de moneda y espacios
  s = s.replace(/[$€£\s]/g, '')

  // Detectar formato:
  //   "1,581.00" (US): la coma es miles, el punto es decimal
  //   "1.581,00" (EU): el punto es miles, la coma es decimal
  //   "1,581"    (sin decimales): la coma es miles
  //   "1581"     (sin separadores)
  //   "0.5"      (decimal con punto)
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Determinar cuál es el separador decimal por la posición
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato europeo: 1.581,00 → quitar puntos, coma → punto
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato US: 1,581.00 → quitar comas
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Solo comas: pueden ser miles o decimal
    // Heurística: si hay 3 dígitos después de la última coma, es separador de miles
    const after = s.split(',').pop()
    if (after.length === 3 && !s.match(/^\d?,\d{3}$/)) {
      // "207,625" → coma de miles
      s = s.replace(/,/g, '')
    } else {
      // "0,5" o "73,9" → coma decimal
      s = s.replace(',', '.')
    }
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toBoolean(v) {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['si','sí','1','true','t','yes'].includes(s)) return true
  if (['no','0','false','f'].includes(s)) return false
  return null
}

function parseTipologia(v) {
  if (v == null) return null
  if (typeof v === 'number') return String(Math.round(v))
  return String(v).trim()
}

function parseVariante(v) {
  if (v == null) return null
  v = unmangleExcelDate(v, 'variante')
  if (v == null) return null
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v)
    return String(v)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d+)\.0+$/)
  if (m) return m[1]
  return s
}

function variantToSkuSegment(variante) {
  return String(variante).replace('.', '_')
}

// ─────────────────────────────────────────────────────────────────────────────
// Generación del SKU
// ─────────────────────────────────────────────────────────────────────────────

function buildSku({ linea, tipologia, variante, nombre, sistema, m2 }) {
  const lc = LINEA_CODE[linea]
  const sc = SISTEMA_CODE[sistema]
  if (!lc || !sc) return null
  const t = `T${tipologia}`
  const v = `V${variantToSkuSegment(variante)}`
  const n = normalizeName(nombre)
  const a = padArea(m2)
  return `${lc}-${t}-${v}-${n}-${sc}-${a}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing del Excel
// ─────────────────────────────────────────────────────────────────────────────

function parseExcel() {
  const wb = xlsx.readFile(EXCEL_PATH, { cellDates: true })
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) throw new Error(`Sheet no encontrado: ${SHEET_NAME}`)

  const rows = xlsx.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: null,
    dateNF: 'yyyy-mm-dd',
  })

  let currentLinea = null
  let currentSegmento = null
  const records = []
  const skipped = []

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const lineaCell = row[0]
    const segCell   = row[1]
    const tipologia = parseTipologia(row[2])
    const varianteRaw = row[3]
    const nombre = row[4]
    const estilo = row[5]
    const sistema = row[6]
    // Col 7 = SKU SC (lo ignoramos, generamos el nuestro)
    const m2cub = toNumber(row[8])
    const m2sem = toNumber(row[9])
    const plantas = toNumber(row[10])
    const dormLabel = row[11]
    const banos = toNumber(row[12])
    const toilette = toBoolean(row[13])
    const lavaderoRaw = row[14]
    const parrilla = toBoolean(row[15])
    const costoPlano = toNumber(row[16])
    // row[17] = OFERTA (texto)
    const precioLista     = toNumber(row[18])
    const precioListaM2   = toNumber(row[19])
    const anticipoLista   = toNumber(row[20])
    const precioContado   = toNumber(row[21])
    const precioContadoM2 = toNumber(row[22])
    const anticipoContado = toNumber(row[23])
    const precioPozo      = toNumber(row[24])
    const precioPozoM2    = toNumber(row[25])
    const anticipoPozo    = toNumber(row[26])

    // Track herencia
    if (typeof lineaCell === 'string' && ['BOSQUE','ATLAS','TERRA'].includes(lineaCell.trim())) {
      currentLinea = lineaCell.trim()
    }
    if (typeof segCell === 'string' && segCell.trim()) {
      currentSegmento = segCell.trim()
    }

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) continue
    if (nombre.startsWith('LOTE')) continue
    if (nombre.startsWith('La siguiente')) continue
    if (nombre === 'NOMBRE COMERCIAL' || nombre === 'NOMBRE') continue

    if (!sistema || !m2cub || !tipologia || varianteRaw == null) {
      skipped.push({ row: i + 1, nombre, motivo: 'datos faltantes (sistema/m2/tipología/variante)' })
      continue
    }

    const variante = parseVariante(varianteRaw)
    if (!variante) {
      skipped.push({ row: i + 1, nombre, motivo: 'variante inválida' })
      continue
    }

    const sistemaNorm = String(sistema).trim().toUpperCase()
                          .replace('HORMIGON', 'HORMIGÓN')

    if (!SISTEMA_CODE[sistemaNorm]) {
      skipped.push({ row: i + 1, nombre, motivo: `sistema desconocido: ${sistema}` })
      continue
    }

    const sku = buildSku({
      linea:    currentLinea,
      tipologia,
      variante,
      nombre,
      sistema:  sistemaNorm,
      m2:       m2cub,
    })

    if (!sku) {
      skipped.push({ row: i + 1, nombre, motivo: 'no se pudo construir SKU' })
      continue
    }

    const beds = parseBedrooms(dormLabel)
    const lavadero = unmangleExcelDate(lavaderoRaw, 'lavadero')

    records.push({
      sku,
      brand: 'HAUSIND',
      linea: currentLinea,
      segmento: currentSegmento,
      tipologia_code: tipologia,
      variante,
      style_name: normalizeName(nombre),
      estilo: ESTILO_NORMALIZADO[estilo] || estilo,
      sistema_constructivo: sistemaNorm,
      area_m2: m2cub,
      area_semicubierta_m2: m2sem,
      floors: plantas ? Math.round(plantas) : null,
      bedrooms_label: dormLabel != null ? String(dormLabel).trim() : null,
      min_bedrooms: beds.min,
      max_bedrooms: beds.max,
      bathrooms: banos,
      toilette: toilette ?? false,
      lavadero: lavadero != null ? String(lavadero) : null,
      parrilla: parrilla ?? false,
      costo_plano_usd:       costoPlano,
      precio_lista_usd:      precioLista,
      precio_lista_m2_usd:   precioListaM2,
      precio_contado_usd:    precioContado,
      precio_contado_m2_usd: precioContadoM2,
      precio_pozo_usd:       precioPozo,
      precio_pozo_m2_usd:    precioPozoM2,
      anticipo_lista_usd:    anticipoLista,
      anticipo_contado_usd:  anticipoContado,
      anticipo_pozo_usd:     anticipoPozo,
      status: 'active',
    })

    if (VERBOSE) {
      const priceInfo = precioLista ? `$${precioLista.toLocaleString('es-AR')}` : '(sin precio)'
      console.log(`  ✓ R${i+1} → ${sku.padEnd(38)} ${priceInfo}`)
    }
  }

  return { records, skipped }
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación
// ─────────────────────────────────────────────────────────────────────────────

async function importToSupabase(records) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const CHUNK = 50
  let inserted = 0
  const errors = []

  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('house_catalog')
      .upsert(chunk, { onConflict: 'sku', ignoreDuplicates: false })
      .select('sku')

    if (error) {
      errors.push({ chunk: i / CHUNK, error: error.message })
      console.error(`  ❌ Chunk ${i / CHUNK}: ${error.message}`)
    } else {
      inserted += data?.length || 0
      console.log(`  ✓ Chunk ${i / CHUNK + 1}: ${data?.length || 0} registros procesados`)
    }
  }

  return { inserted, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Import de modelos a house_catalog')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Excel:    ${EXCEL_PATH}`)
  console.log(`  Sheet:    ${SHEET_NAME}`)
  console.log(`  Modo:     ${DRY_RUN ? 'DRY RUN (no escribe DB)' : 'PROD'}`)
  console.log('')

  console.log('▸ Parseando Excel…')
  const { records, skipped } = parseExcel()

  console.log(`  ✓ ${records.length} modelos parseados`)
  if (skipped.length) {
    console.log(`  ⚠ ${skipped.length} filas saltadas:`)
    skipped.forEach(s => console.log(`     R${s.row} (${s.nombre}): ${s.motivo}`))
  }

  // Estadística
  const byLinea = records.reduce((acc, r) => {
    acc[r.linea] = (acc[r.linea] || 0) + 1
    return acc
  }, {})
  console.log('')
  console.log('  Distribución por línea:')
  Object.entries(byLinea).forEach(([l, n]) => console.log(`     ${l}: ${n}`))

  // Estadística de campos numéricos
  const conPrecio = records.filter(r => r.precio_lista_usd != null).length
  const conCosto = records.filter(r => r.costo_plano_usd != null).length
  console.log('')
  console.log('  Calidad de datos:')
  console.log(`     Con precio_lista_usd: ${conPrecio} / ${records.length}`)
  console.log(`     Con costo_plano_usd:  ${conCosto} / ${records.length}`)

  // Validar duplicados
  const skuSet = new Set()
  const dupes = []
  for (const r of records) {
    if (skuSet.has(r.sku)) dupes.push(r.sku)
    skuSet.add(r.sku)
  }
  if (dupes.length) {
    console.log('')
    console.error(`  ❌ SKUs duplicados detectados (${dupes.length}):`)
    dupes.forEach(s => console.error(`     ${s}`))
    process.exit(1)
  }

  if (DRY_RUN) {
    console.log('')
    console.log('▸ DRY RUN — primeros 8 registros:')
    records.slice(0, 8).forEach(r => {
      const p = r.precio_lista_usd ? `$${r.precio_lista_usd.toLocaleString('es-AR')}` : '?'
      console.log(`     ${r.sku.padEnd(38)} ${r.area_m2}m²  ${p}`)
    })
    console.log('')
    console.log('  ✓ Para escribir a DB, correr sin --dry-run')
    return
  }

  console.log('')
  console.log('▸ Escribiendo a Supabase…')
  const { inserted, errors } = await importToSupabase(records)

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✓ Procesados:  ${inserted}`)
  console.log(`  ⚠ Saltados:    ${skipped.length}`)
  console.log(`  ❌ Errores:     ${errors.length}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (errors.length) process.exit(1)
}

main().catch(err => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
