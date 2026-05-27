/**
 * lib/content/model-naming.ts
 *
 * Helpers de display del nombre comercial de un modelo según la convención
 * unificada que arranca con 0046_tipologias_y_naming:
 *
 *   CASA <TIPOLOGIA> Estilo <ESTILO>
 *   (orden gobernado por lineas.naming_strategy.order)
 *
 * Composición completa de la ficha:
 *
 *   "CASA NODO Estilo PAMPA · 2 Dormitorios + lavadero ext."
 *
 * Donde:
 *   - `Estilo PAMPA` viene de house_catalog.style_name + DISPLAY_NAMES
 *   - `NODO` viene de house_catalog.tipologia_code_new
 *   - `2 Dormitorios` viene de lineas.variante_labels[variante_base]
 *   - `+ lavadero ext.` viene de house_catalog.feature_delta
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
  /** EJE / NODO / ZETA / DECK */
  tipologia_code_new: string | null | undefined
  /** Variante cruda ("0", "2", "3.1"). */
  variante?: string | null
  /** Label de la variante ya resuelto contra lineas.variante_labels. */
  variante_label?: string | null
  /** feature_delta de house_catalog (sub-variantes). */
  feature_delta?: string | null
  /** Estrategia de naming de la línea (default tipologia-first). */
  strategy?: NamingStrategy
}

/**
 * Devuelve el nombre base sin variante:
 *   { style: 'Pampa', tipologia: 'NODO', strategy: tipologia-first }
 *   → "CASA NODO PAMPA"
 *
 * (Sin la palabra "Estilo". Para layout en dos líneas usar `splitModelTitle`.)
 *
 * Si no hay tipología, cae a "Casa Pampa" (compat con el legacy).
 */
export function displayModelTitle(input: DisplayModelNameInput): string {
  const split = splitModelTitle(input)
  if (!split.hero) return ''
  return split.eyebrow ? `${split.eyebrow} ${split.hero}` : split.hero
}

/**
 * Versión en dos partes para layout vertical:
 *   { eyebrow: 'CASA NODO', hero: 'PAMPA' }
 *
 * El consumidor decide cómo presentarlas (eyebrow chico arriba, hero
 * grande/bold abajo). Si no hay tipología, eyebrow='CASA' y hero=estilo.
 */
export function splitModelTitle(
  input: DisplayModelNameInput,
): { eyebrow: string; hero: string } {
  const strategy = input.strategy ?? DEFAULT_NAMING_STRATEGY
  const styleRaw = (input.style_name ?? '').toUpperCase()
  const tipo = (input.tipologia_code_new ?? '').toUpperCase()
  if (!styleRaw && !tipo) return { eyebrow: '', hero: '' }
  if (!tipo) return { eyebrow: 'CASA', hero: styleRaw }
  if (strategy.order === 'style-first') {
    return { eyebrow: `CASA ${styleRaw}`, hero: tipo }
  }
  return { eyebrow: `CASA ${tipo}`, hero: styleRaw }
}

/**
 * Compone la cadena completa con variante y feature_delta:
 *
 *   "CASA NODO Estilo PAMPA · 2 Dormitorios + lavadero ext."
 *
 * El separador "·" se usa entre el título y la variante. El feature_delta
 * se concatena directo al label de variante con un espacio.
 */
export function displayModelName(input: DisplayModelNameInput): string {
  const title = displayModelTitle(input)
  const variLabel = (input.variante_label ?? '').trim()
  const delta = (input.feature_delta ?? '').trim()
  const suffix = [variLabel, delta].filter(Boolean).join(' ')
  return suffix ? `${title} · ${suffix}` : title
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
