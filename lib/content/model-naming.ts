/**
 * lib/content/model-naming.ts
 *
 * Helpers de display del nombre comercial de un modelo. Convive en 2 modos:
 *
 *   • Nuevo (post-0090): 4 ejes independientes en house_catalog
 *       Casa [Circulación] [Morfología] [Estilo] — Acceso [X] / Área Social [Y]
 *       Ej: "Casa EJES CUBO Pampa — Acceso Flip · Área Social Anterior"
 *
 *   • Legacy (pre-0090): un solo tipologia_code_new (EJES/NODO/CUBO/ZETA/DECK)
 *       Casa <TIPOLOGIA> Estilo <ESTILO>
 *       Ej: "Casa NODO Estilo Pampa"
 *
 * Cuál se usa: si circulacion+morfologia están presentes → modo nuevo;
 * si no → fallback al legacy (modelos no backfilleados, marcas distintas a
 * Hausind que todavía no usan los 4 ejes).
 *
 * Composición completa de la ficha (modo nuevo):
 *   "Casa EJES CUBO Pampa — Acceso Flip · Área Social Anterior · 2 Dormitorios + lavadero ext."
 *
 * Pure functions: no DB calls. Server + client safe.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Display de estilos (apóstrofos y acentos restaurados)
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_DISPLAY: Record<string, string> = {
  // Bosque
  AMBAY: "Amba'y",
  "AMBA'Y": "Amba'y",
  LAPACHO: 'Lapacho',
  CAMBOATA: 'Camboatá',
  'CAMBOATÁ': 'Camboatá',
  ALECRIN: 'Alecrín',
  'ALECRÍN': 'Alecrín',
  GUAYUBIRA: 'Guayubirá',
  'GUAYUBIRÁ': 'Guayubirá',
  TIMBO: 'Timbó',
  'TIMBÓ': 'Timbó',
  CEDRO: 'Cedro',
  INGA: 'Ingá',
  'INGÁ': 'Ingá',
  ANCHICO: 'Anchico',
  // Atlas
  PAMPA: 'Pampa',
  CALIFORNIA: 'California',
  ESCANDINAVIA: 'Escandinavia',
  LANCASTER: 'Lancaster',
  PATAGONIA: 'Patagonia',
  // Terra
  LANIN: 'Lanín',
  'LANÍN': 'Lanín',
  COPAHUE: 'Copahue',
  DOMUYO: 'Domuyo',
  MAHUIDA: 'Mahuida',
  TROMEN: 'Tromen',
}

/** Devuelve el nombre del estilo con apóstrofos/acentos canónicos. */
export function styleDisplayName(style_name: string | null | undefined): string {
  if (!style_name) return ''
  const key = style_name.toUpperCase()
  if (STYLE_DISPLAY[key]) return STYLE_DISPLAY[key]
  // Fallback: title-case del raw (mantiene tildes ya presentes).
  return style_name[0].toUpperCase() + style_name.slice(1).toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Naming strategy (espejo del jsonb en lineas.naming_strategy)
// ─────────────────────────────────────────────────────────────────────────────

export type NamingStrategy = {
  /** 'tipologia-first' = "CASA NODO Estilo PAMPA"; 'style-first' = "CASA PAMPA NODO". */
  order: 'tipologia-first' | 'style-first'
  /** Qué entra entre CASA y el estilo. Hoy todas usan 'tipologia'. */
  suffix_source: 'tipologia' | 'variante'
}

export const DEFAULT_NAMING_STRATEGY: NamingStrategy = {
  order: 'tipologia-first',
  suffix_source: 'tipologia',
}

// ─────────────────────────────────────────────────────────────────────────────
// displayModelName — la API pública
// ─────────────────────────────────────────────────────────────────────────────

export type DisplayModelNameInput = {
  style_name: string | null | undefined
  /** Legacy single-axis: EJES/NODO/CUBO/ZETA/DECK. Fallback cuando los 4 ejes no están. */
  tipologia_code_new: string | null | undefined
  /** 4 ejes nuevos (post-0090). Si circulacion+morfologia están → modo nuevo. */
  circulacion?: string | null
  morfologia?: string | null
  acceso?: string | null
  area_social?: string | null
  /** Variante cruda ("0", "2", "3.1"). */
  variante?: string | null
  /** Label de la variante ya resuelto contra lineas.variante_labels. */
  variante_label?: string | null
  /** feature_delta de house_catalog (sub-variantes). */
  feature_delta?: string | null
  /** Estrategia de naming de la línea (default tipologia-first). */
  strategy?: NamingStrategy
  /** Cantidad de pisos. Si ≥2 el hero se sufija con romanos ("AMBA'Y II"). */
  floors?: number | null
}

function floorsSuffix(floors: number | null | undefined): string {
  if (!floors || floors <= 1) return ''
  if (floors === 2) return ' II'
  if (floors === 3) return ' III'
  return ''
}

function hasNewAxes(input: DisplayModelNameInput): boolean {
  return Boolean(
    (input.circulacion ?? '').trim() && (input.morfologia ?? '').trim(),
  )
}

/**
 * Devuelve el nombre base sin variante ni descriptor:
 *   Modo nuevo:    "Casa EJES CUBO Pampa"
 *   Modo legacy:   "CASA NODO PAMPA"
 *
 * Para layout en dos líneas usar `splitModelTitle`.
 */
export function displayModelTitle(input: DisplayModelNameInput): string {
  const split = splitModelTitle(input)
  if (!split.hero) return ''
  return split.eyebrow ? `${split.eyebrow} ${split.hero}` : split.hero
}

/**
 * Versión en dos partes para layout vertical.
 *
 *   Modo nuevo:    { eyebrow: 'CASA EJES CUBO', hero: 'PAMPA' }
 *   Modo legacy:   { eyebrow: 'CASA NODO',      hero: 'PAMPA' }
 *
 * El consumidor decide cómo presentarlas (eyebrow chico arriba, hero
 * grande/bold abajo). Hero y eyebrow van todos en MAYÚSCULAS para que el
 * título completo lea como un bloque visual coherente. La diferenciación es
 * por peso (eyebrow regular, hero bold), no por capitalización.
 */
export function splitModelTitle(
  input: DisplayModelNameInput,
): { eyebrow: string; hero: string } {
  const suf = floorsSuffix(input.floors)
  if (hasNewAxes(input)) {
    const circ = (input.circulacion ?? '').toUpperCase()
    const morfo = (input.morfologia ?? '').toUpperCase()
    const heroNew = (input.style_name ?? '').toUpperCase()
    if (!heroNew) return { eyebrow: '', hero: '' }
    return { eyebrow: `CASA ${circ} ${morfo}`, hero: `${heroNew}${suf}` }
  }
  // Legacy
  const strategy = input.strategy ?? DEFAULT_NAMING_STRATEGY
  const styleRaw = (input.style_name ?? '').toUpperCase()
  const tipo = (input.tipologia_code_new ?? '').toUpperCase()
  if (!styleRaw && !tipo) return { eyebrow: '', hero: '' }
  if (!tipo) return { eyebrow: 'CASA', hero: `${styleRaw}${suf}` }
  if (strategy.order === 'style-first') {
    return { eyebrow: `CASA ${styleRaw}${suf}`, hero: tipo }
  }
  return { eyebrow: `CASA ${tipo}`, hero: `${styleRaw}${suf}` }
}

/**
 * Descriptor de Acceso + Área Social (sólo modo nuevo).
 *   { acceso: 'Flip', area_social: 'Anterior' } → "Acceso Flip · Área Social Anterior"
 * Devuelve '' si ninguno está presente.
 */
export function modelDescriptor(input: DisplayModelNameInput): string {
  const parts: string[] = []
  const acc = (input.acceso ?? '').trim()
  const soc = (input.area_social ?? '').trim()
  if (acc) parts.push(`Acceso ${acc}`)
  if (soc) parts.push(`Área Social ${soc}`)
  return parts.join(' · ')
}

/**
 * Compone la cadena completa.
 *
 *   Modo nuevo:
 *     "Casa EJES CUBO Pampa — Acceso Flip · Área Social Anterior · 2 Dormitorios + lavadero ext."
 *   Modo legacy:
 *     "CASA NODO PAMPA · 2 Dormitorios + lavadero ext."
 *
 * El separador "—" antecede al descriptor de ejes adicionales (modo nuevo);
 * "·" separa descriptor / variante / feature_delta.
 */
export function displayModelName(input: DisplayModelNameInput): string {
  const title = displayModelTitle(input)
  const descriptor = modelDescriptor(input)
  const variLabel = (input.variante_label ?? '').trim()
  const delta = (input.feature_delta ?? '').trim()
  const tail = [variLabel, delta].filter(Boolean).join(' ')

  let out = title
  if (descriptor) out += ` — ${descriptor}`
  if (tail) out += ` · ${tail}`
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveVarianteLabel — busca el label en lineas.variante_labels usando
// la variante BASE (ignora sub-variantes 0.1 / 1.2).
// ─────────────────────────────────────────────────────────────────────────────

export function resolveVarianteLabel(
  variante_labels: Record<string, string> | null | undefined,
  variante: string | null | undefined,
): string | null {
  if (!variante_labels || !variante) return null
  const base = String(variante).split('.')[0]
  return variante_labels[base] ?? null
}
