/**
 * lib/content/header-defaults.ts
 *
 * Fuente ÚNICA de los textos por defecto de cada slide del header (los que
 * antes estaban hardcodeados sueltos en HeroRow). Lo usan:
 *   - HeroRow  → fallback de render cuando no hay contenido en DB.
 *   - admin/portal → prefill del editor con el contenido EFECTIVO/publicado
 *                    (así el form nunca está vacío; se edita una palabra sin
 *                    reescribir).
 *
 * Solo los campos que cada slide realmente muestra. El "Ver más"/modal
 * (`long_body`) NO tiene default acá: vacío = se usa el modal armado por
 * defecto del slide (crece/flex); cargarlo lo reemplaza.
 */

import type {
  HeaderSlide,
  HeaderSlideKind,
} from '@/lib/supabase/queries/header_content'

export type HeaderDefaultFields = {
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
}

export const HEADER_DEFAULTS: Partial<
  Record<HeaderSlideKind, HeaderDefaultFields>
> = {
  pasos: {
    title: '4 Simples pasos para acceder a tu nueva casa financiada.',
  },
  principal: {
    title: 'La casa que querés, en las\ncondiciones que necesitás.',
  },
  crece: {
    eyebrow: 'Concepto',
    title: 'La Casa que Crece',
    body: 'Nos propusimos crear un ambiente que acompañe cada etapa de la vida familiar, y después de mucho trabajo e investigación, la idea original de un gran arquitecto como Alvar Aalto nos dio la respuesta que buscábamos. Una vivienda que evoluciona junto a quienes la habitan.',
  },
  flex: {
    eyebrow: 'Sistema',
    title: 'Flex Build Suit',
    body: 'Quienes hacemos Hausind® ya hemos acompañado a miles de familias a tener hogares eficientes, modernos y accesibles, en todo el país. Más de 50.000 M2 de experiencia nos avalan.',
  },
  'lineas-intro': {
    eyebrow: 'TRES LÍNEAS, TRES MUNDOS',
    title: 'Descubrí la línea que mejor se adapta a tu estilo.',
    body: 'De casas premium a soluciones modulares. Cada línea responde a un estilo de vida diferente.',
  },
}

/** Valor efectivo de un campo: fila > heredado > default del módulo. */
export function effectiveField(
  kind: HeaderSlideKind,
  field: keyof HeaderDefaultFields,
  ...candidates: (string | null | undefined)[]
): string {
  for (const c of candidates) {
    if (c != null && c !== '') return c
  }
  return HEADER_DEFAULTS[kind]?.[field] ?? ''
}

/**
 * defaultValues para el editor de un singleton: prefilla con el contenido
 * EFECTIVO (fila propia → heredado → default), nunca vacío. `inherited` se
 * pasa solo en B2B (la fila B2C); en B2C/marca va null.
 * `long_body`/`cta_*` no tienen default (vacío = modal/CTA por defecto).
 */
export function editorDefaults(
  kind: HeaderSlideKind,
  own: HeaderSlide | null | undefined,
  inherited?: HeaderSlide | null,
): Partial<HeaderSlide> {
  const d = HEADER_DEFAULTS[kind] ?? {}
  // En modo CREATE (la fila aún no existe) prefilleamos con defaults +
  // herencia B2B→B2C para que el editor no arranque vacío. En modo EDIT
  // (own existe), mostramos LITERALMENTE lo que está guardado: si el user
  // borró un campo, debe quedar vacío y no auto-rellenarse con el default.
  const isEdit = Boolean(own)
  const ownVal = (v: string | null | undefined): string =>
    v == null ? '' : v
  const pick = (
    a?: string | null,
    b?: string | null,
    c?: string,
  ): string => (a && a.trim()) || (b && b.trim()) || c || ''
  return {
    // admin_label: solo se respeta el valor propio (es interno, no hereda).
    admin_label: own?.admin_label ?? '',
    eyebrow: isEdit ? ownVal(own?.eyebrow) : pick(own?.eyebrow, inherited?.eyebrow, d.eyebrow),
    title: isEdit ? ownVal(own?.title) : pick(own?.title, inherited?.title, d.title),
    subtitle: isEdit ? ownVal(own?.subtitle) : pick(own?.subtitle, inherited?.subtitle, d.subtitle),
    body: isEdit ? ownVal(own?.body) : pick(own?.body, inherited?.body, d.body),
    long_body: isEdit ? ownVal(own?.long_body) : pick(own?.long_body, inherited?.long_body),
    cta_label: isEdit ? ownVal(own?.cta_label) : pick(own?.cta_label, inherited?.cta_label),
    cta_url: isEdit ? ownVal(own?.cta_url) : pick(own?.cta_url, inherited?.cta_url),
    status: own?.status ?? 'active',
    sort_order: own?.sort_order ?? 0,
  }
}
