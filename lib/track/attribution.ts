/**
 * lib/track/attribution.ts
 *
 * Resolución de atribución de campaña, COMPARTIDA por los dos caminos de
 * escritura (beacon /api/track y el form de leads). Que no diverjan es
 * crítico: un lead atribuido distinto que sus eventos rompe el CPL por
 * banner. Server-only en la práctica, pero son funciones puras.
 */

export type Utm = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
}

export function emptyUtm(): Utm {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  }
}

export function parseUtm(search: string): Utm {
  try {
    const q = new URLSearchParams(search || '')
    const g = (k: string) => {
      const v = q.get(k)
      return v && v.trim() ? v.trim() : null
    }
    return {
      utm_source: g('utm_source'),
      utm_medium: g('utm_medium'),
      utm_campaign: g('utm_campaign'),
      utm_content: g('utm_content'),
      utm_term: g('utm_term'),
    }
  } catch {
    return emptyUtm()
  }
}

export function hasUtm(u: Utm): boolean {
  return Object.values(u).some((v) => v !== null)
}

const SLUG_RE = /^\/casa-financiada\/([^/?#]+)/

export function slugFromPath(path: string | null | undefined): string | null {
  if (!path) return null
  const m = SLUG_RE.exec(path)
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null
}

/**
 * Atribución efectiva: el slug del path gana; si no, la cookie cf_camp.
 * Los utm del query ganan; si no hay, la cookie cf_utm (seteada en el
 * landing_view). Sin nada → slug null + utm vacío.
 */
export function resolveAttribution(opts: {
  path?: string | null
  search?: string | null
  getCookie: (name: string) => string | undefined
}): { campaign_slug: string | null; utm: Utm } {
  const slug =
    slugFromPath(opts.path) || opts.getCookie('cf_camp') || null

  let utm = parseUtm(opts.search ?? '')
  if (!hasUtm(utm)) {
    const raw = opts.getCookie('cf_utm')
    if (raw) {
      try {
        utm = { ...emptyUtm(), ...(JSON.parse(raw) as Partial<Utm>) }
      } catch {
        /* cookie corrupta → utm vacío */
      }
    }
  }
  return { campaign_slug: slug, utm }
}
