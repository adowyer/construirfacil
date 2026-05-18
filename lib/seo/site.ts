/**
 * lib/seo/site.ts
 * Base URL del sitio para sitemap/robots (absolutos). Mismo env que el
 * metadataBase de app/layout.tsx — una sola fuente.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://construirfacil.com'
).replace(/\/+$/, '')
