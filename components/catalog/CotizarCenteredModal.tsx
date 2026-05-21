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
import { buildAsesorMailto } from '@/lib/cta/mailto'
import { track } from '@/lib/track/client'
import type { CotizadorData } from '@/lib/content/cotizador-data'

export default function CotizarCenteredModal({
  open,
  onClose,
  cotizador,
  basePriceUsd,
  context,
  onOpenComparativo,
}: {
  open: boolean
  onClose: () => void
  cotizador: CotizadorData
  basePriceUsd: number | null
  context: { model?: string; variante?: string | null; sistema?: string | null }
  /** Si está, se muestra el link "Ver comparativo" — el callback debería
   *  cerrar la modal y expandir/scrollear al cuadro comparativo del modelo. */
  onOpenComparativo?: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reservarOpen, setReservarOpen] = useState(false)

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

  const detail = [
    context.model,
    context.variante ? `Variante ${context.variante}` : null,
    context.sistema,
  ]
    .filter(Boolean)
    .join(' · ')

  const reservarContext: ReservarContext = {
    model: context.model,
    variante: context.variante,
    sistema: context.sistema,
    priceUsd: basePriceUsd,
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
        <div className="cf-cotizar-modal-inner">
          <button
            type="button"
            className="cf-cotizar-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>

          <p className="cf-cotizar-modal-eyebrow">Tu cotización</p>
          <h3 className="cf-cotizar-modal-title">
            Diseñá la casa que podés pagar
          </h3>
          {detail && <p className="cf-cotizar-modal-detail">{detail}</p>}

          <div className="cf-cotizar-modal-uber">
            <CotizadorUber
              tiers={cotizador.tiers}
              basePriceUsd={basePriceUsd}
              caveatHtml={cotizador.caveatHtml}
              context={context}
              hideCta
            />
          </div>

          <div className="cf-cotizar-modal-disclaimer">
            <p>
              <strong>Por qué los precios son orientativos.</strong> Nuestras
              casas no tienen un precio &ldquo;de catálogo&rdquo; porque cada
              cliente la configura a su medida. El valor final depende de la{' '}
              <strong>variante</strong> (m² y ambientes), el{' '}
              <strong>sistema constructivo</strong> (Wood, Steel u Hormigón
              Plus) y las <strong>terminaciones</strong> que elijas. Los
              precios que ves son la referencia más cercana sobre la
              configuración base; el número exacto lo cerramos juntos cuando
              definimos los detalles.
            </p>
            {onOpenComparativo && (
              <p>
                Si querés conocer más sobre las variantes disponibles en este
                modelo y lo que cada una incluye podés ver nuestro cuadro
                comparativo con todos los detalles.
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
            <a
              href={buildAsesorMailto({ linea: context.model ?? undefined })}
              className="cf-cotizar-panel-cta-secondary"
              onClick={() =>
                track('asesor_click', { source: 'cotizar_modal', ...context })
              }
            >
              Conversar con Ximia
            </a>
            <button
              type="button"
              className="cf-cotizar-panel-cta-primary"
              onClick={() => {
                track('reservar_open', { source: 'cotizar_modal', ...context })
                setReservarOpen(true)
              }}
            >
              Quiero que me contacten
            </button>
          </div>
        </div>
      </dialog>

      <ReservarModal
        open={reservarOpen}
        onClose={() => setReservarOpen(false)}
        context={reservarContext}
      />
    </>
  )
}
