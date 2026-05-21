'use client'

/**
 * components/catalog/CotizarModal.tsx
 *
 * "Persiana" de cotización: NO es un modal centrado — es un overlay que
 * sube como una persiana sobre el cuadro que lo contiene (el comparativo).
 * El padre debe ser position:relative + overflow:hidden (.cf-pn ya lo es).
 *
 * Contenido:
 *   1. Selector Uber (3 tramos con precio USD por tramo — sin cuota).
 *   2. Dos CTAs al pie: "Reservar esta casa" (abre ReservarModal con el
 *      LeadForm prefilled) y "Conversar con Ximia" (asesor por mail/wp).
 *
 * El form NO vive más acá — separamos la decisión de precio de la
 * captación del lead: el usuario primero compara precios y después
 * decide si reservar o conversar.
 */

import { useEffect, useState } from 'react'
import CotizadorUber from './CotizadorUber'
import ReservarModal, { type ReservarContext } from './ReservarModal'
import { buildAsesorMailto } from '@/lib/cta/mailto'
import { track } from '@/lib/track/client'
import type { CotizadorData } from '@/lib/content/cotizador-data'

export default function CotizarModal({
  open,
  onClose,
  cotizador,
  basePriceUsd,
  context,
}: {
  open: boolean
  onClose: () => void
  cotizador: CotizadorData
  basePriceUsd: number | null
  context: { model?: string; variante?: string | null; sistema?: string | null }
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const [reservarOpen, setReservarOpen] = useState(false)

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
      <div
        className={`cf-cotizar-panel${open ? ' is-open' : ''}`}
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Cotizá tu casa"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cf-cotizar-panel-bar">
          <span className="cf-cotizar-panel-eyebrow">Tu cotización</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cf-cotizar-panel-close"
          >
            Cerrar ↓
          </button>
        </div>

        <div className="cf-cotizar-panel-scroll">
          <h3 className="cf-cotizar-panel-title">
            Diseñá la casa que podés pagar
          </h3>
          {detail && <p className="cf-cotizar-panel-detail">{detail}</p>}

          <div className="cf-cotizar-panel-uber">
            <CotizadorUber
              tiers={cotizador.tiers}
              basePriceUsd={basePriceUsd}
              caveatHtml={cotizador.caveatHtml}
              context={context}
              hideCta
            />
          </div>

          <div className="cf-cotizar-panel-ctas">
            <a
              href={buildAsesorMailto({
                linea: context.model ?? undefined,
              })}
              className="cf-cotizar-panel-cta-secondary"
              onClick={() =>
                track('asesor_click', { source: 'cotizar_persiana', ...context })
              }
            >
              Conversar con Ximia
            </a>
            <button
              type="button"
              className="cf-cotizar-panel-cta-primary"
              onClick={() => {
                track('reservar_open', { source: 'cotizar_persiana', ...context })
                setReservarOpen(true)
              }}
            >
              Quiero que me contacten
            </button>
          </div>
        </div>
      </div>

      <ReservarModal
        open={reservarOpen}
        onClose={() => setReservarOpen(false)}
        context={reservarContext}
      />
    </>
  )
}
