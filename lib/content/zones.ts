/**
 * lib/content/zones.ts
 *
 * Resolución de reglas zonales por marca (`marca_zonas`) y aplicación al
 * pricing. Compañera de 0047_ubicacion.sql.
 *
 * Resolución: most-specific-wins.
 *
 *   Para una tupla (marca_id, provincia_id, linea_id, sc):
 *
 *     score = (linea? 2 : 0) + (sc? 1 : 0)
 *
 *   Iteramos las reglas que matchean (matcheable: linea=null o linea_id ok;
 *   sc=null o sc ok) y tomamos la de mayor score.
 *
 *   Para extra_charge: solo lo lee de la regla general (linea=null,
 *   sc=null) porque el schema lo enforce con CHECK constraint.
 *
 * Pure functions. Server + client safe.
 */

export interface MarcaZonaRule {
  id: string
  marca_id: string
  provincia_id: string
  linea_id: string | null
  sistema_constructivo: string | null
  excluded: boolean
  price_modifier_pct: number | null
  extra_charge_amount: number | null
  extra_charge_label: string | null
  contact_only: boolean
  promo_label: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'archived'
}

/** Forma efectiva resuelta — lo que el consumidor usa. */
export interface EffectiveZoneRule {
  excluded: boolean
  contact_only: boolean
  price_modifier_pct: number | null
  /** Cargo plano (siempre desde la regla general). */
  extra_charge_amount: number | null
  /** Label admin del extra_charge (visible solo en el admin / debug). */
  extra_charge_label: string | null
  promo_label: string | null
}

const EMPTY_RULE: EffectiveZoneRule = {
  excluded: false,
  contact_only: false,
  price_modifier_pct: null,
  extra_charge_amount: null,
  extra_charge_label: null,
  promo_label: null,
}

function matches(
  r: MarcaZonaRule,
  q: { marca_id: string; provincia_id: string; linea_id: string | null; sc: string | null },
): boolean {
  if (r.status !== 'active') return false
  if (r.marca_id !== q.marca_id) return false
  if (r.provincia_id !== q.provincia_id) return false
  if (r.linea_id !== null && r.linea_id !== q.linea_id) return false
  if (r.sistema_constructivo !== null && r.sistema_constructivo !== q.sc) return false
  return true
}

function specificityScore(r: MarcaZonaRule): number {
  return (r.linea_id ? 2 : 0) + (r.sistema_constructivo ? 1 : 0)
}

/**
 * Resuelve la regla zonal efectiva. Toma:
 *   - extra_charge (label + amount) SIEMPRE de la regla general (linea=null, sc=null).
 *   - Resto de los campos (excluded, contact_only, modifier, promo) de la regla
 *     más específica que matchee.
 *
 * Si ninguna regla matchea, devuelve EMPTY_RULE (cero efecto).
 */
export function resolveZoneRule(
  rules: MarcaZonaRule[],
  q: { marca_id: string; provincia_id: string; linea_id: string | null; sc: string | null },
): EffectiveZoneRule {
  const matched = rules.filter((r) => matches(r, q))
  if (matched.length === 0) return EMPTY_RULE

  // Más específica gana para flags y modifier.
  let best = matched[0]
  let bestScore = specificityScore(best)
  for (const r of matched.slice(1)) {
    const s = specificityScore(r)
    if (s > bestScore) {
      best = r
      bestScore = s
    }
  }

  // extra_charge solo de la regla general (linea=null, sc=null), siempre.
  const general = matched.find(
    (r) => r.linea_id === null && r.sistema_constructivo === null,
  )

  return {
    excluded: best.excluded,
    contact_only: best.contact_only,
    price_modifier_pct: best.price_modifier_pct,
    extra_charge_amount: general?.extra_charge_amount ?? null,
    extra_charge_label: general?.extra_charge_label ?? null,
    promo_label: best.promo_label,
  }
}

/**
 * Aplica `price_modifier_pct` + `extra_charge_amount` a los 3 precios.
 *
 *   precio_mostrado = precio_base × (1 + modifier_pct / 100) + extra_charge
 *
 * Sin desglose: el cliente ve un único precio. Transparencia hacia abajo, no
 * hacia arriba (decisión 6 del kickoff: "no queremos que sientan que les
 * cobramos más porque viven en Salta").
 *
 * NULL en cualquier precio base → null en el resultado.
 */
export function applyZonePricing(
  prices: {
    precio_lista_usd: number | null
    precio_contado_usd: number | null
    precio_pozo_usd: number | null
  },
  rule: EffectiveZoneRule,
): {
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
} {
  const factor = 1 + (rule.price_modifier_pct ?? 0) / 100
  const extra = rule.extra_charge_amount ?? 0
  const apply = (p: number | null): number | null =>
    p == null ? null : p * factor + extra
  return {
    precio_lista_usd: apply(prices.precio_lista_usd),
    precio_contado_usd: apply(prices.precio_contado_usd),
    precio_pozo_usd: apply(prices.precio_pozo_usd),
  }
}

/**
 * Helper de etiqueta admin/debug: describe el delta del precio para una regla.
 * Ej: "+10% + USD 1.200 transporte". Útil para tooltips/admin previews.
 */
export function describeZoneDelta(rule: EffectiveZoneRule): string {
  const parts: string[] = []
  if (rule.price_modifier_pct != null && rule.price_modifier_pct !== 0) {
    const sign = rule.price_modifier_pct > 0 ? '+' : ''
    parts.push(`${sign}${rule.price_modifier_pct}%`)
  }
  if (rule.extra_charge_amount != null && rule.extra_charge_amount !== 0) {
    parts.push(
      `+ USD ${rule.extra_charge_amount.toLocaleString('es-AR')}${
        rule.extra_charge_label ? ` (${rule.extra_charge_label})` : ''
      }`,
    )
  }
  return parts.join(' ')
}
