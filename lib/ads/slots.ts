/**
 * lib/ads/slots.ts
 *
 * Registro CANÓNICO de los 7 ad units servidos vía GAM. Los `slotId` deben
 * matchear exacto los ad units creados en Google Ad Manager (ver
 * docs/media-kit.md para la especificación de venta).
 *
 * Regla dura: cualquier `<AdSlot slotId="...">` en el código consume UNO de
 * estos IDs — sin strings sueltos. Cambiar un slot ID acá + en GAM al mismo
 * tiempo; si no coinciden, GAM no sirve creativos.
 *
 * Sobre los TAMAÑOS
 * ─────────────────
 * El doc de Federal Media pide que los slots "ajusten al width del buscador
 * (1500)" y "al height del slider" — es decir, los tamaños IAB (970×250,
 * 300×600, …) son la REFERENCIA COMERCIAL del anunciante, pero los
 * creativos se entregan y se sirven en las medidas REALES del sitio
 * manteniendo la PROPORCIÓN del IAB original. Ver docs/media-kit.md tabla
 * "IAB → Real".
 *
 * `sizes` = medidas reales que el <AdSlot> reserva y GAM sirve. El anunciante
 * entrega creativos AL TAMAÑO REAL (no al IAB nativo). Esto es lo que
 * evita que los banners queden "flotando" desalineados con el layout.
 */

import type { AdSize } from './gpt'

export const AD_SLOTS = {
  /** Billboard arriba del HeroRow — home general y home de marca.
   *  IAB: 970×250 → Real: 1500×386 (ancho al buscador, alto proporcional).
   *  Plan: Main Partner Nacional / Socio Regional / Proveedor Estratégico. */
  home_top: {
    id: 'home_top',
    sizes: [[1500, 386]] as AdSize[],
    iab: '970×250',
    label: 'Home top billboard',
  },
  /** Super-leaderboard arriba de los filtros del catálogo.
   *  IAB: 970×90 → Real: 1500×139.
   *  Plan: Main Partner Nacional / Socio Regional. */
  catalog_top: {
    id: 'catalog_top',
    sizes: [[1500, 139]] as AdSize[],
    iab: '970×90',
    label: 'Catálogo top leaderboard',
  },
  /** Half-page skyscraper entre slides del scroll horizontal HeroRow.
   *  IAB: 300×600 → Real: 210×420 (alto al slider, ancho proporcional).
   *  Plan: Main Partner Nacional / Socio Regional. */
  hero_scroll_main: {
    id: 'hero_scroll_main',
    sizes: [[210, 420]] as AdSize[],
    iab: '300×600',
    label: 'Hero scroll main (skyscraper)',
  },
  /** Skyscraper secundario entre slides del scroll HeroRow.
   *  IAB: 160×600 → Real: 112×420.
   *  Plan: Socio Regional. */
  hero_scroll_secondary: {
    id: 'hero_scroll_secondary',
    sizes: [[112, 420]] as AdSize[],
    iab: '160×600',
    label: 'Hero scroll secondary (skyscraper delgado)',
  },
  /** ½ altura entre slides del scroll HeroRow.
   *  IAB: 300×250 → Real: 252×210 (alto a 50% del slider).
   *  Plan: Socio Regional / Proveedor Estratégico. */
  hero_scroll_half: {
    id: 'hero_scroll_half',
    sizes: [[252, 210]] as AdSize[],
    iab: '300×250',
    label: 'Hero scroll half (½ altura)',
  },
  /** Leaderboard entre grupos verticales del catálogo (cada N model rows).
   *  IAB: 728×90 → Real: 1200×148 (ancho a la grilla). */
  content_inline: {
    id: 'content_inline',
    sizes: [[1200, 148]] as AdSize[],
    iab: '728×90',
    label: 'Content inline leaderboard',
  },
  /** Sticky bottom persistente en mobile — tamaño nativo IAB.
   *  Plan: Socio Regional / Proveedor Estratégico. */
  mobile_sticky: {
    id: 'mobile_sticky',
    sizes: [[300, 50]] as AdSize[],
    iab: '300×50',
    label: 'Mobile sticky',
  },
  /** Inline entre secciones del scroll en mobile — tamaño nativo IAB.
   *  Plan: Main Partner Nacional. */
  mobile_inline: {
    id: 'mobile_inline',
    sizes: [[300, 250]] as AdSize[],
    iab: '300×250',
    label: 'Mobile inline',
  },
} as const

export type AdSlotKey = keyof typeof AD_SLOTS
