'use client'

/**
 * components/ads/AdPageTargeting.tsx
 *
 * Setea los targeting keys de PÁGINA en GPT (`page_type`, `provincia`,
 * `marca`). Aplicados a TODOS los slots renderizados en esta página vía
 * pubads().setTargeting — se propagan a los ad requests del próximo
 * refresh de cada slot.
 *
 * Reactivo: si el visitante cambia de provincia (filtro del catálogo), el
 * targeting se re-setea y los slots que hagan refresh piden ads con la
 * nueva key. Los slots que ya sirvieron un ad NO cambian hasta el próximo
 * fetch — GAM sirve ads cada N segundos con `enableLazyLoad` + interacción
 * (default: sin refresh automático, sólo scroll-in).
 *
 * Uso:
 *   <AdPageTargeting pageType="catalog" marcaSlug={selectedMarca?.slug} />
 * En páginas que ya viven en ProvinciaProvider, la provincia se lee del
 * hook — no hay que pasarla como prop.
 */

import { useEffect } from 'react'
import { useProvincia } from '@/components/providers/ProvinciaProvider'
import { setPageTargeting, GAM_ENABLED } from '@/lib/ads/gpt'

type Props = {
  /** Tipo de página, para trafficing de line items por sección. */
  pageType: 'home' | 'catalog' | 'model_detail'
  /** Slug de la marca si el visitante está dentro del catálogo de UNA
   *  marca específica (ej. `/hausind`). Null en el marketplace agregador. */
  marcaSlug?: string | null
}

export default function AdPageTargeting({ pageType, marcaSlug }: Props) {
  const { provinciaId, provincias } = useProvincia()
  // El slug es lo que el trafficker usa en GAM (más legible que un UUID).
  const provinciaSlug =
    provincias.find((p) => p.id === provinciaId)?.slug ?? null

  useEffect(() => {
    if (!GAM_ENABLED) return
    setPageTargeting({
      page_type: pageType,
      provincia: provinciaSlug,
      marca: marcaSlug ?? null,
    })
  }, [pageType, provinciaSlug, marcaSlug])

  return null
}
