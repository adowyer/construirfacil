/**
 * lib/content/model-slug.ts
 *
 * Slug canónico de un modelo + variante para URLs (`/modelos/[slug]`) y
 * tracking. Formato: `casa-<tipologia>-<estilo>-v<variante>`.
 *
 * Ejemplos:
 *   { tipologia_code_new: 'NODO', style_name: 'PAMPA',     variante: '0'   } → casa-nodo-pampa-v0
 *   { tipologia_code_new: 'NODO', style_name: 'PAMPA',     variante: '2.1' } → casa-nodo-pampa-v2-1
 *   { tipologia_code_new: 'EJE',  style_name: "AMBA'Y",    variante: '1'   } → casa-eje-ambay-v1
 *   { tipologia_code_new: 'DECK', style_name: 'LANÍN',     variante: '2'   } → casa-deck-lanin-v2
 *
 * Sin tipología (legacy / línea no migrada todavía) cae a `casa-<estilo>-v<variante>`.
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
  tipologia_code_new: string | null | undefined
  variante?: string | null
}

export function modelSlug(input: ModelSlugInput): string {
  const tipo = (input.tipologia_code_new ?? '').trim()
  const style = (input.style_name ?? '').trim()
  const variante = String(input.variante ?? '').replace('.', '-').trim()

  const parts = ['casa']
  if (tipo) parts.push(token(tipo))
  if (style) parts.push(token(style))
  if (variante) parts.push(`v${token(variante)}`)

  return parts.join('-')
}

/**
 * Slug a nivel "grupo" (sin variante), útil para URLs de la ficha del modelo
 * que listan todas las variantes en la misma página.
 *
 *   { tipologia_code_new: 'NODO', style_name: 'PAMPA' } → casa-nodo-pampa
 */
export function modelGroupSlug(input: Omit<ModelSlugInput, 'variante'>): string {
  return modelSlug({ ...input, variante: null })
}
