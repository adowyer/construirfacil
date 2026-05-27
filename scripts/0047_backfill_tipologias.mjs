#!/usr/bin/env node
// =============================================================================
// Backfill: tipologia_code_new + feature_delta + corrección dorms Atlas V3
// Naming #2 — one-shot. Lee planilla, escribe en house_catalog.
//
// Uso:
//   node scripts/0047_backfill_tipologias.mjs            # dry-run (default)
//   node scripts/0047_backfill_tipologias.mjs --apply    # escribe
// =============================================================================

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')

// ---------------- env ----------------
const env = readFileSync('.env.local', 'utf8')
  .split('\n').filter((l) => l.includes('='))
  .reduce((acc, l) => { const i = l.indexOf('='); acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc }, {})
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ---------------- helpers ----------------
function clean(s) { if (s == null) return ''; return String(s).normalize('NFC').replace(/[‘’]/g, "'").trim() }
function cleanVariante(s) { return clean(s).replace(',', '.') }
function stripAccents(s) { return clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '') }
function normKey(s) { return stripAccents(s).toUpperCase().replace(/\s+/g, ' ').trim() }
function stripBosqueSuffix(n) { return clean(n).replace(/\s+(I|II|III|IV)$/i, '').trim() }

const TIP_REMAP = { OPEN: 'DECK' }

function tipologiaFromPlanilla(linea, tipNum, tipLetra) {
  const num = clean(tipNum).toUpperCase()
  const letra = clean(tipLetra).toUpperCase()
  if (['EJE', 'NODO', 'ZETA', 'OPEN', 'DECK'].includes(letra)) {
    return TIP_REMAP[letra] ?? letra
  }
  if (['ATLAS', 'BOSQUE'].includes(linea)) {
    const n = parseInt(num, 10)
    if (n === 1) return 'EJE'
    if (n === 2) return 'NODO'
    if (n === 3) return 'ZETA'
    if (n === 4) return 'DECK'
  }
  return null
}

// ---------------- planilla ----------------
const wb = XLSX.readFile('/Users/adowyer/Projects/Hausind Catalog Prices - naming.xlsx')
const sh = wb.Sheets['SUPERFICIES COSTOS OK']
const rows = XLSX.utils.sheet_to_json(sh, { defval: null, raw: false, header: 1 })

// Canonical Bosque por estilo (resuelve inconsistencias CAMBOATÁ '3'/'OPEN')
const bosqueCanonical = new Map()
for (let i = 2; i < rows.length; i++) {
  const r = rows[i]
  if (!r || clean(r[0]).toUpperCase() !== 'BOSQUE' || !r[5]) continue
  const baseName = normKey(stripBosqueSuffix(r[5]))
  const letra = clean(r[3]).toUpperCase()
  if (['EJE', 'NODO', 'ZETA', 'OPEN', 'DECK'].includes(letra)) {
    if (!bosqueCanonical.has(baseName)) bosqueCanonical.set(baseName, TIP_REMAP[letra] ?? letra)
  }
}

// Index planilla por key + meta para feature_delta computation
const planillaByKey = new Map()
const planillaForBase = new Map() // (linea,style,SC,baseVariante) → row con info para diff

for (let i = 2; i < rows.length; i++) {
  const r = rows[i]
  if (!r || !r[0]) continue
  const linea = clean(r[0]).toUpperCase()
  if (!['ATLAS', 'BOSQUE', 'TERRA'].includes(linea)) continue
  if (r[4] == null || r[4] === '') continue
  if (['MÓDULOS', 'TODAS'].includes(clean(r[4]).toUpperCase())) continue

  const tipNum = r[2]
  const tipLetra = r[3]
  const variante = cleanVariante(r[4])
  const nombre = clean(r[5])
  const sc = clean(r[7])
  const m2 = r[9]
  const dorm = r[12]
  const banos = r[13]
  const lavadero = clean(r[15])

  const baseStyleName = linea === 'BOSQUE' ? stripBosqueSuffix(nombre) : nombre

  let tipologia = tipologiaFromPlanilla(linea, tipNum, tipLetra)
  if (linea === 'BOSQUE') {
    const canon = bosqueCanonical.get(normKey(baseStyleName))
    if (canon) tipologia = canon
  }

  const key = linea === 'BOSQUE'
    ? `${linea}|${normKey(baseStyleName)}|${variante}|${normKey(sc)}`
    : `${linea}|${normKey(baseStyleName)}|${variante}|${normKey(sc)}|${clean(tipNum)}`

  const entry = { linea, tipologia, variante, m2, dorm, banos, lavadero, baseStyleName, sc, tipNum }
  planillaByKey.set(key, entry)

  // Index también por variante base (sin sub) para poder calcular el delta
  const baseKey = `${linea}|${normKey(baseStyleName)}|${variante.split('.')[0]}|${normKey(sc)}|${clean(tipNum)}`
  if (!variante.includes('.')) {
    planillaForBase.set(baseKey, entry)
  }
}

// ---------------- feature_delta computer ----------------
function computeFeatureDelta(p) {
  if (!p.variante.includes('.')) return null
  const baseKey = `${p.linea}|${normKey(p.baseStyleName)}|${p.variante.split('.')[0]}|${normKey(p.sc)}|${clean(p.tipNum)}`
  const base = planillaForBase.get(baseKey)
  if (!base) return null
  const deltas = []
  const m2Sub = parseFloat(p.m2) || 0
  const m2Base = parseFloat(base.m2) || 0
  const m2Diff = +(m2Sub - m2Base).toFixed(1)
  if (m2Diff > 0) deltas.push(`+${m2Diff} m²`)
  const banSub = parseInt(p.banos, 10) || 0
  const banBase = parseInt(base.banos, 10) || 0
  if (banSub > banBase) deltas.push('+ baño')
  // lavadero ext vs int (campo libre, comparación simple)
  if (p.lavadero && base.lavadero) {
    const subExt = /ext/i.test(p.lavadero)
    const baseExt = /ext/i.test(base.lavadero)
    if (subExt && !baseExt) deltas.push('+ lavadero ext.')
  }
  return deltas.length ? deltas.join(' ') : null
}

// ---------------- DB load ----------------
const { data: dbRows, error } = await sb
  .from('house_catalog')
  .select('id,sku,linea,style_name,variante,sistema_constructivo,tipologia_code,tipologia_code_new,feature_delta,min_bedrooms,max_bedrooms')

if (error) { console.error('DB error:', error); process.exit(1) }

// ---------------- compute updates ----------------
const updates = []
const unmatched = []
let dormsCorrected = 0

for (const d of dbRows) {
  const linea = clean(d.linea).replace(/^L[ÍI]NEA\s+/i, '').toUpperCase()
  const skuTip = (String(d.sku ?? '').match(/-T(\w+)-/) ?? [])[1] ?? clean(d.tipologia_code)
  const key = linea === 'BOSQUE'
    ? `${linea}|${normKey(d.style_name ?? '')}|${cleanVariante(d.variante)}|${normKey(d.sistema_constructivo ?? '')}`
    : `${linea}|${normKey(d.style_name ?? '')}|${cleanVariante(d.variante)}|${normKey(d.sistema_constructivo ?? '')}|${skuTip}`

  const p = planillaByKey.get(key)
  if (!p) { unmatched.push(d.sku); continue }

  const patch = {}
  if (p.tipologia && p.tipologia !== d.tipologia_code_new) patch.tipologia_code_new = p.tipologia
  const fd = computeFeatureDelta(p)
  if (fd !== (d.feature_delta ?? null)) patch.feature_delta = fd

  // Atlas V3 corrección dorms: planilla dice 4, real es 3.
  if (linea === 'ATLAS') {
    const base = cleanVariante(d.variante).split('.')[0]
    if (base === '3') {
      if (d.min_bedrooms !== 3) { patch.min_bedrooms = 3; dormsCorrected++ }
      if (d.max_bedrooms !== 3) { patch.max_bedrooms = 3 }
    }
  }

  if (Object.keys(patch).length > 0) {
    updates.push({ id: d.id, sku: d.sku, patch })
  }
}

console.log(`\nBackfill — análisis`)
console.log(`  DB rows: ${dbRows.length}`)
console.log(`  unmatched: ${unmatched.length}`)
console.log(`  SKUs con cambios: ${updates.length}`)
console.log(`  Atlas V3 dorms corregidos: ${dormsCorrected}`)

// Resumen por línea
const summary = {}
for (const u of updates) {
  const linea = (u.sku.startsWith('HA-') ? 'ATLAS' : u.sku.startsWith('HB-') ? 'BOSQUE' : 'TERRA')
  summary[linea] = (summary[linea] || 0) + 1
}
console.log(`  por línea:`, summary)

// Muestra de cambios
console.log(`\nMuestra de 8 cambios:`)
for (const u of updates.slice(0, 8)) {
  console.log(`  ${u.sku} ←`, u.patch)
}

const withDelta = updates.filter((u) => u.patch.feature_delta)
console.log(`\nSKUs con feature_delta calculado: ${withDelta.length}`)
for (const u of withDelta.slice(0, 12)) {
  console.log(`  ${u.sku} → "${u.patch.feature_delta}"`)
}

if (unmatched.length > 0) {
  console.log(`\n⚠ unmatched SKUs:`)
  for (const sku of unmatched) console.log(`  ${sku}`)
  console.log(`\nAbortando — todo o nada.`)
  process.exit(1)
}

if (!APPLY) {
  console.log(`\n[DRY-RUN] No se escribió nada. Para aplicar:`)
  console.log(`  node scripts/0047_backfill_tipologias.mjs --apply`)
  process.exit(0)
}

// ---------------- apply ----------------
console.log(`\n[APPLY] Escribiendo ${updates.length} updates...`)
let ok = 0, fail = 0
for (const u of updates) {
  const { error } = await sb.from('house_catalog').update(u.patch).eq('id', u.id)
  if (error) { console.error(`  ✗ ${u.sku}:`, error.message); fail++ }
  else { ok++ }
}
console.log(`✓ ${ok} ok, ${fail} fail`)
