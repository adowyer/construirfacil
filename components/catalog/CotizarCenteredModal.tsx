'use client'

/**
 * components/catalog/CotizarCenteredModal.tsx
 *
 * Modal "Cotizar" CENTRADA — para los CTAs que viven fuera del comparativo
 * (ficha del listado, botón flotante, banner). Adentro del comparativo
 * seguimos usando la PERSIANA (CotizarModal): ahí el usuario ya eligió
 * variante + SC, no hace falta disclaimer ni link.
 *
 * Esta modal:
 *   - Muestra los 3 tier cards con el precio USD (base = primera variante).
 *   - Disclaimer claro: por qué los precios son orientativos.
 *   - Link "Ver comparativo del modelo" → cierra la modal y dispara
 *     `onOpenComparativo()` (en ModelRow: expand + scroll a Panel7).
 *   - Dos CTAs: Reservar (ReservarModal) + Conversar con Ximia (mailto).
 *
 * Patrón `<dialog>` nativo (top layer) → no se atrapa en transforms ni
 * overflow de ancestros, mismo mecanismo que DeliveryConditionsModal /
 * ReservarModal.
 */

import { useEffect, useRef, useState } from 'react'
import CotizadorUber from './CotizadorUber'
import ReservarModal, { type ReservarContext } from './ReservarModal'
import { WaitlistContent } from './WaitlistContent'
import { getAsesorHref } from '@/lib/cta/mailto'
import { requestOpenXimiaWidget } from '@/lib/cta/open-ximia'
import { XIMIA_ENABLED } from '@/lib/feature-flags'
import { track } from '@/lib/track/client'
import type { CotizadorData, SkuPrices } from '@/lib/content/cotizador-data'

export default function CotizarCenteredModal({
  open,
  onClose,
  cotizador,
  pricesUsd,
  context,
  excluded = false,
  onOpenComparativo,
}: {
  open: boolean
  onClose: () => void
  cotizador: CotizadorData
  /** Los 3 precios del SKU de referencia (variante elegida o "desde"). */
  pricesUsd: SkuPrices
  context: {
    model?: string
    variante?: string | null
    sistema?: string | null
    marca?: string | null
    linea?: string | null
    /** Datos extra para persistir el lead + email + WA per-marca. */
    marca_id?: string | null
    marca_whatsapp?: string | null
    model_slug?: string | null
    style_name?: string | null
    tipologia_code_new?: string | null
    provincia_id?: string | null
    tiene_lote?: 'si' | 'no' | null
  }
  /** Zona excluded (marca no opera en la provincia del usuario). En ese caso
   *  la modal renderiza un mensaje informativo + CTA a Ximia en vez del
   *  cotizador (que sugeriría precio para algo que no se ofrece). */
  excluded?: boolean
  /** Si está, se muestra el link "Ver comparativo" — el callback debería
   *  cerrar la modal y expandir/scrollear al cuadro comparativo del modelo. */
  onOpenComparativo?: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reservarOpen, setReservarOpen] = useState(false)
  // Tramo elegido en el cotizador (key + label + precio ya modificado).
  // "Quiero esta casa" lo usa para llevar el precio del tramo, no el base.
  const [selectedTier, setSelectedTier] = useState<{
    key: string
    label: string
    priceUsd: number | null
  } | null>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Línea de contexto: "Estás viendo: Casa X - Marca, Línea". La variante
  // elegida no se nombra acá — se refleja en el precio del cotizador.
  const subject = [context.marca, context.linea].filter(Boolean).join(', ')
  const detail = context.model
    ? `Estás viendo: ${context.model}${subject ? ` - ${subject}` : ''}`
    : ''

  const reservarContext: ReservarContext = {
    model: context.model,
    variante: context.variante,
    sistema: context.sistema,
    tier: selectedTier?.label ?? null,
    priceUsd: selectedTier?.priceUsd ?? pricesUsd.lista ?? null,
    marca_id: context.marca_id ?? null,
    marca_name: context.marca ?? null,
    marca_whatsapp: context.marca_whatsapp ?? null,
    model_slug: context.model_slug ?? null,
    style_name: context.style_name ?? null,
    tipologia_code_new: context.tipologia_code_new ?? null,
    provincia_id: context.provincia_id ?? null,
    tiene_lote: context.tiene_lote ?? null,
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className="cf-cotizar-modal"
        onClick={(e) => {
          if (e.target === dialogRef.current) onClose()
        }}
        onClose={onClose}
      >
        {/* Gate del contenido al `open`: cada ModelRow del catálogo monta un
            CotizarCenteredModal, y cuando la casa está `excluded` para la
            provincia del visitante, el children incluye <WaitlistContent> →
            <AntiSpamFields> → widget de Cloudflare Turnstile. Si dejamos el
            contenido montado con el <dialog> cerrado, 20+ widgets Turnstile
            corren challenge en paralelo desde el mount y cuelgan la tab
            ("Pages Unresponsive: challenges.cloudflare.com"). Con el gate,
            los widgets solo aparecen cuando el user efectivamente abre el
            modal de una casa. */}
        {open && (
        <div className="cf-cotizar-modal-inner">
          <button
            type="button"
            className="cf-cotizar-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>

          {excluded ? (
            <WaitlistContent
              context={{
                marca: context.marca,
                marca_id: context.marca_id ?? null,
                provincia_id: context.provincia_id ?? null,
                tiene_lote: context.tiene_lote ?? null,
                model_slug: context.model_slug ?? null,
                style_name: context.style_name ?? null,
                tipologia_code_new: context.tipologia_code_new ?? null,
                linea: context.linea ?? null,
              }}
              detail={detail}
              onClose={onClose}
            />
          ) : (
            <>
              <p className="cf-cotizar-modal-eyebrow">Tu cotización</p>
              <h3 className="cf-cotizar-modal-title">
                Cotizá tu casa: variante, sistema y plazo
              </h3>
              {detail && <p className="cf-cotizar-modal-detail">{detail}</p>}

              <div className="cf-cotizar-modal-uber">
                <CotizadorUber
                  tiers={cotizador.tiers}
                  pricesUsd={pricesUsd}
                  caveatHtml={cotizador.caveatHtml}
                  context={context}
                  hideCta
                  onTierChange={setSelectedTier}
                />
              </div>

              <div className="cf-cotizar-modal-disclaimer">
                <p>
                  <strong>El precio es orientativo y dinámico.</strong> Nuestras casas no
                  tienen un precio &ldquo;de catálogo&rdquo; porque cada cliente las configura
                  a su preferencia. El valor final depende de la{' '}
                  <strong>variante</strong> —superficie y distribución—, el{' '}
                  <strong>sistema constructivo</strong> —Wood Plus, Steel Plus o Stone Plus—,
                  las <strong>terminaciones</strong> que elijas —revestimientos o aislaciones
                  opcionales— y los accesorios del catálogo —parrilla, lavadero exterior,
                  equipo solar, etc.—.
                </p>

                <p>
                  <strong>El precio se ajusta por “tiempo” y “volumen”.</strong> Creamos un
                  exclusivo <strong>modelo de cotización colectiva por cupos</strong> que
                  premia tu flexibilidad. Al organizar las obras por ubicación y volumen de
                  ventas reducimos los costos, y trasladamos ese ahorro directo a tu precio
                  final. En cualquier caso,{' '}
                  <strong>
                    mejoramos cualquier presupuesto y somos hasta un 50% más rápidos
                  </strong>{' '}
                  que la construcción tradicional.
                </p>

                <p>
                  Los precios que ves en la casa elegida son la referencia más cercana sobre
                  la configuración estándar, sujeto a ajustes personales en el momento de la
                  formalización de la compra.
                </p>

                {onOpenComparativo && (
                  <p>
                    Si querés conocer más sobre las variantes disponibles en este modelo y lo
                    que cada una incluye podés ver nuestro cuadro comparativo con todos los
                    detalles.
                  </p>
                )}
              </div>

              <div className="cf-cotizar-modal-ctas">
                {onOpenComparativo && (
                  <button
                    type="button"
                    className="cf-cotizar-panel-cta-secondary"
                    onClick={() => {
                      track('cotizar_open_comparativo', { source: 'cotizar_modal', ...context })
                      onOpenComparativo()
                      onClose()
                    }}
                  >
                    Ver cuadro comparativo
                  </button>
                )}
                {XIMIA_ENABLED && (
                  <a
                    href={getAsesorHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cf-cotizar-panel-cta-secondary"
                    onClick={(e) => {
                      if (requestOpenXimiaWidget('cotizar_modal')) e.preventDefault()
                      track('asesor_click', { source: 'cotizar_modal', ...context })
                    }}
                  >
                    Conversar con Ximia
                  </a>
                )}
                <button
                  type="button"
                  className="cf-cotizar-panel-cta-primary"
                  onClick={() => {
                    track('reservar_open', { source: 'cotizar_modal', ...context })
                    setReservarOpen(true)
                  }}
                >
                  Quiero esta casa →
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </dialog>

      <ReservarModal
        open={reservarOpen}
        onClose={() => setReservarOpen(false)}
        context={reservarContext}
      />
    </>
  )
}
