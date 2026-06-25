/**
 * lib/content/model-slug.ts
 *
 * Slug canónico de un modelo + variante para URLs (`/modelos/[slug]`) y tracking.
 *
 * Formato (modo nuevo, post-0090):
 *   casa-<circulacion>-<morfologia>-<estilo>-v<variante>
 *
 * Formato (modo legacy):
 *   casa-<tipologia_code_new>-<estilo>-v<variante>
 *
 * Acceso y Área Social NO entran al slug (mantenerlo corto y estable; varían
 * entre opciones del mismo modelo). Se exponen en la URL como query params si
 * el catálogo lo necesita.
 *
 * Ejemplos:
 *   { circulacion: 'EJES', morfologia: 'CUBO', style_name: 'PAMPA',  variante: '0' }
 *     → casa-ejes-cubo-pampa-v0
 *   { tipologia_code_new: 'NODO', style_name: 'PAMPA', variante: '2.1' }
 *     → casa-nodo-pampa-v2-1
 *   { tipologia_code_new: 'DECK', style_name: 'LANÍN', variante: '2' }
 *     → casa-deck-lanin-v2
 *
 * Pure function. Server + client safe.
 */

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function token(part: string): string {
  return stripDiacritics(part)
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type ModelSlugInput = {
  style_name: string | null | undefined
  /** Legacy single-axis. Fallback cuando circulacion+morfologia faltan. */
  tipologia_code_new: string | null | undefined
  /** Modo nuevo: si ambos presentes, mandan sobre tipologia_code_new. */
  circulacion?: string | null
  morfologia?: string | null
  variante?: string | null
}

export function modelSlug(input: ModelSlugInput): string {
  const circ = (input.circulacion ?? '').trim()
  const morfo = (input.morfologia ?? '').trim()
  const tipo = (input.tipologia_code_new ?? '').trim()
  const style = (input.style_name ?? '').trim()
  const variante = String(input.variante ?? '').replace('.', '-').trim()

  const parts = ['casa']
  if (circ && morfo) {
    parts.push(token(circ), token(morfo))
  } else if (tipo) {
    parts.push(token(tipo))
  }
  if (style) parts.push(token(style))
  if (variante) parts.push(`v${token(variante)}`)

  return parts.join('-')
}

/**
 * Slug a nivel "grupo" (sin variante), útil para URLs de la ficha del modelo
 * que listan todas las variantes en la misma página.
 *
 *   { circulacion: 'EJES', morfologia: 'CUBO', style_name: 'PAMPA' }
 *     → casa-ejes-cubo-pampa
 */
export function modelGroupSlug(input: Omit<ModelSlugInput, 'variante'>): string {
  return modelSlug({ ...input, variante: null })
}
