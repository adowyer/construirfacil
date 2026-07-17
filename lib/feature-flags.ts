/**
 * lib/feature-flags.ts
 *
 * Banderas globales de features. Por default OFF para no exponer integraciones
 * que aún no están en producción.
 *
 * - XIMIA_ENABLED: muestra/oculta TODOS los CTAs "Conversar con Ximia"
 *   (footer, paneles del expandido, modales de cotizar, cards Casa+Lote, etc).
 *   Para activar: setear NEXT_PUBLIC_XIMIA_ENABLED=true en .env.local (dev)
 *   o en Vercel env vars (prod) + redeploy.
 *
 * - XIMIA_CATALOG_WIDGET_ENABLED: monta el widget flotante de Ximia en TODAS
 *   las rutas públicas del catálogo (por default hoy sólo se monta en
 *   /ximia-lab y /ximia-demo). Cuando está activo, los CTAs "Conversar con
 *   Ximia" dejan de ser mailto y abren el widget in-page vía evento global.
 *   Setear NEXT_PUBLIC_XIMIA_CATALOG_WIDGET_ENABLED=true para el rollout.
 */

export const XIMIA_ENABLED = process.env.NEXT_PUBLIC_XIMIA_ENABLED === 'true'
export const XIMIA_CATALOG_WIDGET_ENABLED =
  process.env.NEXT_PUBLIC_XIMIA_CATALOG_WIDGET_ENABLED === 'true'
