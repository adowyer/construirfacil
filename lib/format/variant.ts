/**
 * lib/format/variant.ts
 *
 * Etiqueta mostrable de una variante.
 *
 * - Hasta 0046: "Variante 1" / "Variante 2.1" (fallback que sigue funcionando
 *   si la línea no tiene `variante_labels` poblado todavía).
 * - Desde 0046: si la línea tiene `variante_labels` en BD, devolvemos el label
 *   user-facing ("2 Dormitorios" / "1 Planta") + feature_delta cuando aplica
 *   ("2 Dormitorios + lavadero ext.").
 *
 * Único lugar donde se arma el texto → cambiar acá si se quiere abreviar.
 */

export type VariantLabelContext = {
  /** lineas.variante_labels — mapping variante base → label user-facing. */
  variante_labels?: Record<string, string> | null
  /** house_catalog.feature_delta — "+ baño", "+ lavadero ext.", etc. */
  feature_delta?: string | null
}

export function variantLabel(
  v: string | number,
  ctx?: VariantLabelContext,
): string {
  const vs = String(v)
  const base = vs.split('.')[0]
  const userLabel = ctx?.variante_labels?.[base]
  const main = userLabel ?? `Variante ${vs}`
  const delta = ctx?.feature_delta?.trim()
  return delta ? `${main} ${delta}` : main
}
