/**
 * 08_seed_content.mjs
 * ----------------------------------------------------------------------------
 * Parsea el documento "La Casa que Crece Concepto y Estilos.docx" y siembra
 * (upsert idempotente) los textos en las tablas:
 *   • brand_content   (key='concept', key='process')
 *   • line_content    (por linea + tipologia_code)
 *   • model_content   (por style_name + linea)
 *
 * Source of truth = el .docx. Este script es solo el transporte. Si editás el
 * doc y re-corrés el script, los textos en la DB se actualizan.
 *
 * USO:
 *   1. node 08_seed_content.mjs --dry-run        → imprime el JSON parseado
 *   2. SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node 08_seed_content.mjs --verbose
 *
 * Opcional:
 *   DOC_PATH=...     ruta al docx (default ./La Casa que Crece Concepto y Estilos.docx)
 * ----------------------------------------------------------------------------
 */

import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import fs from 'node:fs'

const DOC_PATH =
  process.env.DOC_PATH ||
  path.resolve('./La Casa que Crece Concepto y Estilos.docx')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

if (!fs.existsSync(DOC_PATH)) {
  console.error(`❌ No se encontró el doc en: ${DOC_PATH}`)
  process.exit(1)
}
if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  console.error('❌ Configurá SUPABASE_URL y SUPABASE_SERVICE_KEY (o usá --dry-run).')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Extracción de párrafos del docx
// ─────────────────────────────────────────────────────────────────────────────

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function extractParagraphs(docxPath) {
  // Saca document.xml del .docx (que es un zip).
  const xml = execSync(`unzip -p "${docxPath}" word/document.xml`, {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })

  // Cada <w:p>...</w:p> es un párrafo. Dentro, varios <w:t>texto</w:t>.
  const pBlocks = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []
  return pBlocks.map((p) => {
    const tMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? []
    return tMatches
      .map((t) => decodeXml(t.replace(/<[^>]+>/g, '')))
      .join('')
      .trim()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parser estructural — tokenizer inline
// ─────────────────────────────────────────────────────────────────────────────
//
// Los headers (LÍNEA X, Casa, TIPOLOGÍA, etc.) a menudo aparecen pegados al
// texto del bloque anterior. En lugar de procesar línea por línea, juntamos
// todo el doc en un solo string y lo recorremos con un tokenizer que detecta
// inline cualquier marcador de sección.

const ESTILOS_LIST = [
  // Ordenados por longitud DESC para que el regex prefiera el más largo
  // (evita que "MODERNO" matchee dentro de "MODERNAMENTE", etc.)
  'MEDITERRÁNEO',
  'INDUSTRIAL',
  'CAMPESTRE',
  'MODERNO',
  'NÓRDICO',
  'CLÁSICO',
  'CHALET',
]

const PATTERNS = [
  { type: 'concept_header', re: /La Casa que Crece\s*\(concepto\)/g },
  { type: 'process_header', re: /NUESTRO PROCESO INDUSTRIAL\s*:/g },
  // Sin \b: en el doc "LÍNEA BOSQUE" puede aparecer pegada a "ACERCA" sin
  // espacio. Como las opciones (ATLAS|BOSQUE|TERRA) son exactas, basta con
  // matchear el nombre completo.
  { type: 'linea_header', re: /LÍNEA\s+(ATLAS|BOSQUE|TERRA)/g },
  { type: 'about_line', re: /ACERCA DE LA LÍNEA\s*:/g },
  // Tipología: número (1, 2, 3) o letra (O, Z, U). Título hasta fin de párrafo.
  { type: 'tipologia', re: /TIPOLOG[ÍI]A\s+(\d+|[OZU])\s*[–\-—]\s*([^\n]+?)(?=\n|$)/g },
  { type: 'estilos_intro', re: /(\d+)\s+ESTILOS\b/g },
  // Casa header. ESTILO desde lista hardcodeada (longest-first) — esto evita
  // que "MODERNO" capture la "La" del párrafo siguiente.
  {
    type: 'casa_header',
    re: new RegExp(
      String.raw`L[íi]nea\s+(ATLAS|BOSQUE|TERRA)\s*\/\s*Casa\s+([A-ZÁÉÍÓÚÑ\`´'’.]+(?:\s+[A-ZÁÉÍÓÚÑ\`´'’.]+)*?)\s*\/\s*ESTILO\s+(${ESTILOS_LIST.join('|')})`,
      'g',
    ),
  },
]

function* tokenize(text) {
  // Encuentra todas las matches de todos los patrones, las ordena por posición.
  const all = []
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      all.push({
        type,
        index: m.index,
        end: m.index + m[0].length,
        groups: m.slice(1),
      })
      // Evitar loop infinito en regex con zero-width matches
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  all.sort((a, b) => a.index - b.index)

  // Eliminar overlaps (si dos patrones matchearon en posiciones cercanas
  // que se solapan, nos quedamos con el primero que empieza).
  const filtered = []
  let lastEnd = -1
  for (const m of all) {
    if (m.index < lastEnd) continue
    filtered.push(m)
    lastEnd = m.end
  }

  // Yieldear: chunk de texto antes de cada match, luego el match.
  let cursor = 0
  for (const m of filtered) {
    if (m.index > cursor) {
      const chunk = text.slice(cursor, m.index)
      if (chunk.trim()) yield { type: 'text', text: chunk }
    }
    yield m
    cursor = m.end
  }
  if (cursor < text.length) {
    const tail = text.slice(cursor)
    if (tail.trim()) yield { type: 'text', text: tail }
  }
}

function parseDocument(paragraphs) {
  // Pre-cleanup: juntar párrafos con \n, sacar comentarios del usuario y URLs.
  let fullText = paragraphs.filter(Boolean).join('\n\n')
  fullText = fullText
    // Comentario tipo "ACERCA DE LAS CASAS: Necesitamos poner ..." — basura
    .replace(/ACERCA DE LAS CASAS:[\s\S]+?(?=NUESTRO PROCESO INDUSTRIAL:|LÍNEA\s+ATLAS|$)/gi, '')
    // URLs sueltas
    .replace(/https?:\/\/\S+/g, '')
    // Limpiar espacios múltiples
    .replace(/[ \t]+/g, ' ')

  const out = {
    brand: { concept: '', process: '' },
    lines: {},
    models: {},
  }

  function ensureLine(linea) {
    if (!out.lines[linea]) {
      out.lines[linea] = { about: '', tipologias: {}, estilos_intro: '' }
    }
    return out.lines[linea]
  }

  // Walker state
  let bucket = null
  let buffer = []
  let currentLinea = null

  function flush() {
    const text = buffer.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
    buffer = []
    if (!bucket || !text) return
    if (bucket.type === 'concept') {
      out.brand.concept = (out.brand.concept ? out.brand.concept + '\n\n' : '') + text
    } else if (bucket.type === 'process') {
      out.brand.process = (out.brand.process ? out.brand.process + '\n\n' : '') + text
    } else if (bucket.type === 'about_line') {
      const L = ensureLine(bucket.linea)
      L.about = (L.about ? L.about + '\n\n' : '') + text
    } else if (bucket.type === 'tipologia') {
      const L = ensureLine(bucket.linea)
      const t = (L.tipologias[bucket.code] ||= { title: bucket.title, body: '' })
      t.body = (t.body ? t.body + '\n\n' : '') + text
    } else if (bucket.type === 'estilos_intro') {
      const L = ensureLine(bucket.linea)
      L.estilos_intro = (L.estilos_intro ? L.estilos_intro + '\n\n' : '') + text
    } else if (bucket.type === 'casa') {
      const k = `${bucket.linea}::${bucket.casa}`
      out.models[k] ||= {
        style_name: bucket.casa,
        linea: bucket.linea,
        estilo: bucket.estilo,
        body: '',
      }
      out.models[k].body = (out.models[k].body ? out.models[k].body + '\n\n' : '') + text
    }
  }

  for (const tok of tokenize(fullText)) {
    if (tok.type === 'text') {
      const t = tok.text.trim()
      if (t) buffer.push(t)
      continue
    }

    flush()

    switch (tok.type) {
      case 'concept_header':
        bucket = { type: 'concept' }
        break
      case 'process_header':
        bucket = { type: 'process' }
        break
      case 'linea_header':
        currentLinea = tok.groups[0].toUpperCase()
        bucket = { type: 'about_line', linea: currentLinea }
        // Pre-creamos el nodo de la línea para que la lista esté completa
        // aunque no tenga "about" body propio.
        ensureLine(currentLinea)
        break
      case 'about_line':
        // Header "ACERCA DE LA LÍNEA:" — si hay línea actual, sigue siendo about
        if (!currentLinea && bucket?.linea) currentLinea = bucket.linea
        bucket = { type: 'about_line', linea: currentLinea || 'ATLAS' }
        break
      case 'tipologia':
        bucket = {
          type: 'tipologia',
          linea: currentLinea || 'ATLAS',
          code: String(tok.groups[0]).toUpperCase(),
          title: String(tok.groups[1]).trim(),
        }
        break
      case 'estilos_intro':
        bucket = { type: 'estilos_intro', linea: currentLinea || 'ATLAS' }
        break
      case 'casa_header': {
        const linea = tok.groups[0].toUpperCase()
        currentLinea = linea
        ensureLine(linea)
        bucket = {
          type: 'casa',
          linea,
          casa: tok.groups[1].trim().replace(/´/g, "'").replace(/[`’]/g, "'"),
          estilo: tok.groups[2].toUpperCase(),
        }
        break
      }
    }
  }
  flush()

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Build de filas para upsert
// ─────────────────────────────────────────────────────────────────────────────

const LINE_LABELS = {
  ATLAS: 'Línea ATLAS',
  BOSQUE: 'Línea BOSQUE',
  TERRA: 'Línea TERRA',
}

function buildRows(parsed) {
  // brand_content rows
  const brand = []
  if (parsed.brand.concept) {
    brand.push({
      key: 'concept',
      label: 'La Casa que Crece (concepto)',
      title: 'La Casa que Crece',
      body: parsed.brand.concept,
      sort_order: 1,
      status: 'active',
    })
  }
  if (parsed.brand.process) {
    brand.push({
      key: 'process',
      label: 'Nuestro Proceso Industrial',
      title: 'Nuestro Proceso Industrial',
      body: parsed.brand.process,
      sort_order: 2,
      status: 'active',
    })
  }

  // line_content rows
  const lineRows = []
  let sort = 0
  for (const [linea, L] of Object.entries(parsed.lines)) {
    if (L.about) {
      lineRows.push({
        linea,
        tipologia_code: null,
        title: LINE_LABELS[linea] ?? linea,
        subtitle: 'Acerca de la línea',
        body: L.about,
        sort_order: sort++,
        status: 'active',
      })
    }
    for (const [code, t] of Object.entries(L.tipologias)) {
      lineRows.push({
        linea,
        tipologia_code: code,
        title: `Tipología ${code}`,
        subtitle: t.title || null,
        body: t.body,
        sort_order: sort++,
        status: 'active',
      })
    }
    if (L.estilos_intro) {
      lineRows.push({
        linea,
        tipologia_code: 'estilos_intro',
        title: 'Estilos',
        subtitle: 'Maneras de habitar',
        body: L.estilos_intro,
        sort_order: sort++,
        status: 'active',
      })
    }
  }

  // model_content rows — body desde el doc. Si después editás desde admin
  // (tagline, lifestyle_tags, etc.) NO se pisan: solo upserteamos body y
  // estilo_label (que viene del header del doc). Otros campos se preservan.
  const modelRows = []
  for (const m of Object.values(parsed.models)) {
    modelRows.push({
      style_name: m.style_name,
      linea: m.linea,
      body: m.body,
      estilo_label: m.estilo
        ? capitalize(m.estilo.toLowerCase())
        : null,
    })
  }

  return { brand, lineRows, modelRows }
}

function capitalize(s) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Upsert
// ─────────────────────────────────────────────────────────────────────────────

async function upsertAll({ brand, lineRows, modelRows }) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  // brand_content: UNIQUE(key)
  const { error: brandErr } = await supabase
    .from('brand_content')
    .upsert(brand, { onConflict: 'key' })
  if (brandErr) throw new Error(`brand_content: ${brandErr.message}`)

  // line_content: UNIQUE(linea, tipologia_code) NULLS NOT DISTINCT
  // El upsert necesita 'linea,tipologia_code' como onConflict.
  const { error: lineErr } = await supabase
    .from('line_content')
    .upsert(lineRows, { onConflict: 'linea,tipologia_code' })
  if (lineErr) throw new Error(`line_content: ${lineErr.message}`)

  // model_content: UNIQUE(style_name, linea). Solo actualizamos body y
  // estilo_label — el resto de campos (tagline, lifestyle_tags, agent_notes,
  // family_size_*) se preservan si ya estaban setteados desde admin.
  // Para hacerlo bien: hacemos upsert pero ignoramos si la fila existe;
  // si no existe, insertamos con defaults.
  // Hack: hacemos primero un select para saber qué existe, luego insert/update
  // selectivos.
  for (const m of modelRows) {
    const { data: existing } = await supabase
      .from('model_content')
      .select('id')
      .eq('style_name', m.style_name)
      .eq('linea', m.linea)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('model_content')
        .update({ body: m.body, estilo_label: m.estilo_label })
        .eq('id', existing.id)
      if (error) throw new Error(`model_content update ${m.style_name}: ${error.message}`)
    } else {
      const { error } = await supabase.from('model_content').insert(m)
      if (error) throw new Error(`model_content insert ${m.style_name}: ${error.message}`)
    }
  }

  return {
    brandCount: brand.length,
    lineCount: lineRows.length,
    modelCount: modelRows.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Seed de contenido — La Casa que Crece (.docx → Supabase)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  DOC:  ${DOC_PATH}`)
  console.log(`  Modo: ${DRY_RUN ? 'DRY RUN' : 'PROD'}`)
  console.log('')

  const paragraphs = extractParagraphs(DOC_PATH)
  console.log(`▸ ${paragraphs.length} párrafos extraídos del doc`)

  const parsed = parseDocument(paragraphs)
  const lineCount = Object.keys(parsed.lines).length
  const tipoCount = Object.values(parsed.lines).reduce(
    (acc, L) => acc + Object.keys(L.tipologias).length,
    0,
  )
  const modelCount = Object.keys(parsed.models).length
  console.log(`▸ ${lineCount} líneas, ${tipoCount} tipologías, ${modelCount} modelos`)
  console.log(`▸ brand.concept: ${parsed.brand.concept ? '✓' : '✗'}`)
  console.log(`▸ brand.process: ${parsed.brand.process ? '✓' : '✗'}`)

  const rows = buildRows(parsed)
  console.log(
    `▸ ${rows.brand.length} brand_content / ${rows.lineRows.length} line_content / ${rows.modelRows.length} model_content`,
  )

  if (VERBOSE) {
    console.log('')
    console.log('  Líneas y tipologías:')
    for (const [linea, L] of Object.entries(parsed.lines)) {
      const tipos = Object.keys(L.tipologias).join(',')
      console.log(`     ${linea.padEnd(8)} tipologías=[${tipos}] estilos_intro=${L.estilos_intro ? '✓' : '✗'}`)
    }
    console.log('  Modelos:')
    for (const m of Object.values(parsed.models)) {
      console.log(`     ${m.linea}/${m.style_name.padEnd(20)} ESTILO=${m.estilo}  body=${m.body.length}c`)
    }
  }

  if (DRY_RUN) {
    console.log('')
    console.log('  ▸ Primer brand_content (preview 200c):')
    console.log(
      '       ',
      (rows.brand[0]?.body || '').slice(0, 200).replace(/\n/g, ' '),
      '...',
    )
    console.log('  ▸ Primer model_content (preview 200c):')
    console.log(
      '       ',
      `${rows.modelRows[0]?.linea}/${rows.modelRows[0]?.style_name}:`,
      (rows.modelRows[0]?.body || '').slice(0, 200).replace(/\n/g, ' '),
      '...',
    )
    return
  }

  console.log('')
  console.log('▸ Escribiendo a Supabase…')
  const r = await upsertAll(rows)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✓ brand_content:  ${r.brandCount}`)
  console.log(`  ✓ line_content:   ${r.lineCount}`)
  console.log(`  ✓ model_content:  ${r.modelCount}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((err) => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
