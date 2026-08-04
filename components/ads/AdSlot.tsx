'use client'

/**
 * components/ads/AdSlot.tsx
 *
 * Slot GAM (Google Ad Manager) reservado con tamaño fijo (evita CLS) y
 * lazy-loaded (GPT `enableLazyLoad` en lib/ads/gpt.ts). Contrato con GAM
 * en docs/media-kit.md; slot IDs definidos en lib/ads/slots.ts.
 *
 * Kill-switch: si `NEXT_PUBLIC_GAM_NETWORK_ID` está vacía, el componente
 * renderea `null` en producción (cero cambio visual mientras Andrea
 * espera la aprobación de AdSense) y un placeholder gris con el slot ID
 * en desarrollo (para verificar posición durante integración).
 *
 * Responsive multi-size: pasar `sizes=[[970,250],[970,90]]` y GAM elige
 * uno según qué line items tengan creativos activos que caben. Reservamos
 * el ALTO del más alto para evitar layout shift si GAM entrega el más
 * grande. El ancho lo maneja el contenedor (centered / max-width).
 */

import { useEffect, useId, useRef, useState } from 'react'
import {
  GAM_ENABLED,
  defineAndDisplay,
  destroySlot,
  loadGPT,
  type AdSize,
} from '@/lib/ads/gpt'

/**
 * Preview mode: se activa por URL (`?ads=preview`) o cookie
 * (`cf_ads_preview=1`). Cuando está on, los placeholders rayados se ven en
 * PROD (aunque no haya Network ID cargado) — útil para mostrarle a un
 * anunciante potencial el inventario "en vivo" sin necesitar campañas
 * trafficked. Se lee client-side; en SSR siempre es false para no romper
 * la hidratación.
 */
function useAdsPreviewMode(): boolean {
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlFlag =
      new URL(window.location.href).searchParams.get('ads') === 'preview'
    const cookieFlag = document.cookie
      .split('; ')
      .some((c) => c === 'cf_ads_preview=1')
    setPreview(urlFlag || cookieFlag)
  }, [])
  return preview
}

/**
 * ¿Debe renderearse el wrapper de un ad slot? Mismo criterio que aplica el
 * propio `<AdSlot>` internamente. Se exporta para que los contenedores
 * (slides del carrusel, cf-ad-wrap, sticky mobile) puedan gatear su propio
 * `<div>` y no reservar ancho/alto vacío cuando el slot va a devolver null.
 * SSR-safe: en el primer render devuelve `GAM_ENABLED || inDev` — así en
 * prod sin Network ID nunca hay flash del wrapper; el preview mode se
 * resuelve client-side y activa el wrapper con un segundo render si hace
 * falta.
 */
export function useAdSlotVisible(): boolean {
  const previewMode = useAdsPreviewMode()
  if (GAM_ENABLED) return true
  if (process.env.NODE_ENV !== 'production') return true
  return previewMode
}

type Props = {
  /** Slot ID de GAM (ad unit path). Ver lib/ads/slots.ts para la lista
   *  canónica. Debe matchear el ad unit trafficked en GAM. */
  slotId: string
  /** Tamaños REALES del slot en el sitio (los que GAM sirve y reserva). */
  sizes: AdSize[]
  /** Tamaño IAB estándar que se le pide al anunciante (ej. `"970×250"`).
   *  Se muestra en el placeholder de dev/preview en vez de las medidas
   *  reales — así el anunciante ve el formato IAB que va a entregar, no
   *  el escalado interno del layout. */
  iabSize?: string
  /** Key-values extra específicos de este slot (además del targeting de
   *  página seteado con `setPageTargeting`). */
  targeting?: Record<string, string | string[]>
  /** Clase extra sobre el div contenedor (spacing, margin, etc.). */
  className?: string
}

export default function AdSlot({ slotId, sizes, iabSize, targeting, className }: Props) {
  // useId genera un ID estable server/client — evita hydration warnings.
  // Sanitizamos porque useId puede devolver ":r0:" que rompe getElementById.
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const divId = `gpt-${slotId}-${uid}`
  const previewMode = useAdsPreviewMode()
  // Ref para saber si YA definimos el slot en este mount — dev con StrictMode
  // dispara useEffect dos veces; sin este guard defineSlot() tira warning
  // "Slot already exists" (idempotent en GAM pero ensucia consola).
  const definedRef = useRef(false)

  useEffect(() => {
    if (!GAM_ENABLED) return
    if (definedRef.current) return
    definedRef.current = true

    loadGPT()
    defineAndDisplay({ slotId, sizes, divId, targeting })

    return () => {
      destroySlot(divId)
      definedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, divId])

  // Alto reservado = el más alto de todos los tamaños aceptados (evita CLS
  // si GAM sirve el más grande). Ancho reservado = el más ancho.
  const maxW = Math.max(...sizes.map((s) => s[0]))
  const maxH = Math.max(...sizes.map((s) => s[1]))

  // Sin Network ID: no reservamos espacio en prod (retornamos null) UNLESS
  // el visitante activó preview mode (URL `?ads=preview` o cookie
  // `cf_ads_preview=1`). En dev siempre mostramos placeholder para poder
  // ver dónde vive el slot antes de que GAM esté configurado.
  if (!GAM_ENABLED) {
    const inDev = process.env.NODE_ENV !== 'production'
    if (!inDev && !previewMode) return null
    return (
      <div
        className={`cf-ad-slot cf-ad-slot--placeholder ${className ?? ''}`}
        style={{
          width: maxW,
          height: maxH,
          maxWidth: '100%',
          background: 'repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 8px, #ececec 8px, #ececec 16px)',
          color: '#666',
          fontFamily: 'system-ui',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          border: '1px dashed #ccc',
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      >
        <strong>AD SLOT (dev)</strong>
        <span>{slotId}</span>
        <span>{iabSize ?? sizes.map((s) => `${s[0]}×${s[1]}`).join(' / ')}</span>
      </div>
    )
  }

  // El wrapper CSS (cf-ad-wrap--home-top / --catalog-top / etc.) puede
  // override el width/height con !important y un aspect-ratio anclado al
  // layout del sitio (1500 / 386, etc.). Cuando no hay wrapper con
  // override, respetamos el tamaño nativo del slot para reservar espacio.
  return (
    <div
      className={`cf-ad-slot ${className ?? ''}`}
      style={{
        width: maxW,
        height: maxH,
        maxWidth: '100%',
      }}
    >
      <div
        id={divId}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
