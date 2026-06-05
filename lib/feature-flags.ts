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
 */

export const XIMIA_ENABLED = process.env.NEXT_PUBLIC_XIMIA_ENABLED === 'true'
