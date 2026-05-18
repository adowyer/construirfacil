/**
 * lib/format/variant.ts
 *
 * Etiqueta mostrable de una variante. Los arquitectos pidieron "Variante 1"
 * en vez de "V1" (los usuarios no entendían la abreviatura). ÚNICO lugar
 * donde se arma el texto → cambiar acá si se quiere abreviar de nuevo.
 */
export const variantLabel = (v: string | number): string => `Variante ${v}`
