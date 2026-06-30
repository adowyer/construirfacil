/**
 * lib/geo/iso-ar.ts
 *
 * Mapping ISO 3166-2:AR (códigos de región) → slug de `public.provincias`.
 * Los códigos son los que devuelve MaxMind GeoIP (usado por Vercel para
 * setear `x-vercel-ip-country-region`).
 *
 * Confiabilidad esperada en Argentina:
 *   • País: ~95-99% (AR vs no-AR).
 *   • Provincia: ~60-80% desktop, ~40-60% móvil (carriers NATean por BA).
 *
 * Conclusión: usar SIEMPRE como sugerencia editable, nunca como verdad.
 */

export const ISO_AR_TO_SLUG: Record<string, string> = {
  A: 'salta',
  B: 'buenos-aires',
  C: 'caba',
  D: 'san-luis',
  E: 'entre-rios',
  F: 'la-rioja',
  G: 'santiago-del-estero',
  H: 'chaco',
  J: 'san-juan',
  K: 'catamarca',
  L: 'la-pampa',
  M: 'mendoza',
  N: 'misiones',
  P: 'formosa',
  Q: 'neuquen',
  R: 'rio-negro',
  S: 'santa-fe',
  T: 'tucuman',
  U: 'chubut',
  V: 'tierra-del-fuego',
  W: 'corrientes',
  X: 'cordoba',
  Y: 'jujuy',
  Z: 'santa-cruz',
}
