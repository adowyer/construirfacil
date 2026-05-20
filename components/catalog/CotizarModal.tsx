'use client'

/**
 * components/catalog/CotizarModal.tsx
 *
 * "Persiana" de cotización: NO es un modal centrado — es un overlay que
 * sube como una persiana sobre el cuadro que lo contiene (el comparativo /
 * la ficha). El padre debe ser position:relative + overflow:hidden (.cf-pn,
 * .cf-st-datos ya lo son). Fondo blanco, mismo estilo que las demás modales.
 *
 * Contiene el selector Uber (plan + cuota en vivo, sin su CTA) y el form de
 * lead (variante light) — al enviarse, todo queda acá. Nunca sale del
 * catálogo, nunca navega a /cotizar.
 */

import { useEffect } from 'react'
import CotizadorUber from './CotizadorUber'
import { LeadForm } from '@/components/LeadForm'
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

  const detail = [
    context.model,
    context.variante ? `Variante ${context.variante}` : null,
    context.sistema,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
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
            fxRef={cotizador.fxRef}
            cuotaProducts={cotizador.cuotaProducts}
            caveatHtml={cotizador.caveatHtml}
            context={context}
            hideCta
          />
        </div>

        <div className="cf-cotizar-panel-divider" />

        <p className="cf-cotizar-panel-formlabel">
          Dejanos tus datos y te contactamos
        </p>
        <LeadForm defaultLocalidad={null} variant="light" />
      </div>
    </div>
  )
}
