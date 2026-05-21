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
import { getAsesorHref } from '@/lib/cta/mailto'
import { track } from '@/lib/track/client'
import type { CotizadorData } from '@/lib/content/cotizador-data'

function displaySC(sc: string): string {
  const u = sc.toUpperCase().trim()
  if (u === 'HORMIGÓN PLUS' || u === 'HORMIGON PLUS' || u === 'CONCRETE PLUS')
    return 'Stone Plus'
  return sc.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

export default function CotizarModal({
  open,
  onClose,
  cotizador,
  basePriceUsd,
  context,
  systems = [],
  priceForSC,
}: {
  open: boolean
  onClose: () => void
  cotizador: CotizadorData
  basePriceUsd: number | null
  context: { model?: string; variante?: string | null; sistema?: string | null }
  /** Sistemas constructivos disponibles para esta variante. Si llega vacío
   *  o con 1 solo elemento, no se muestra el selector (siguen pasando
   *  `basePriceUsd` y `context.sistema` originales sin cambios). */
  systems?: string[]
  /** Resuelve el precio para un SC dado. Permite al modal recalcular cuando
   *  el usuario cambia el pill de SC. Si no se provee, el precio queda fijo
   *  en `basePriceUsd`. */
  priceForSC?: (sc: string | null) => number | null
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

  // Selector de SC dentro del modal (movido desde el comparativo — feedback
  // SH 25). Default = el SC que vino del contexto, o el primero disponible.
  const [selectedSC, setSelectedSC] = useState<string | null>(
    context.sistema ?? systems[0] ?? null,
  )
  useEffect(() => {
    // Si el contexto cambia (ej. otra variante), resincronizar.
    setSelectedSC(context.sistema ?? systems[0] ?? null)
  }, [context.sistema, systems])

  // Precio efectivo según SC seleccionado (si se pasó el helper). Fallback
  // al basePriceUsd original.
  const effectivePrice =
    priceForSC && selectedSC != null ? priceForSC(selectedSC) : basePriceUsd

  const detail = [
    context.model,
    context.variante ? `Variante ${context.variante}` : null,
    selectedSC,
  ]
    .filter(Boolean)
    .join(' · ')

  const reservarContext: ReservarContext = {
    model: context.model,
    variante: context.variante,
    sistema: selectedSC,
    priceUsd: effectivePrice,
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
            Cotizá tu casa: variante, sistema y plazo
          </h3>
          {detail && <p className="cf-cotizar-panel-detail">{detail}</p>}

          {systems.length > 1 && (
            <div className="cf-cotizar-panel-sc-block">
              <p className="cf-cotizar-panel-sc-lbl">Sistema constructivo</p>
              <div className="cf-cotizar-panel-sc-pills">
                {systems.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`cf-pn-pill ${s === selectedSC ? 'active' : ''}`}
                    onClick={() => setSelectedSC(s)}
                  >
                    {displaySC(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="cf-cotizar-panel-uber">
            <CotizadorUber
              tiers={cotizador.tiers}
              basePriceUsd={effectivePrice}
              caveatHtml={cotizador.caveatHtml}
              context={{ ...context, sistema: selectedSC }}
              hideCta
            />
          </div>

          <div className="cf-cotizar-panel-ctas">
            <a
              href={getAsesorHref()}
              target="_blank"
              rel="noopener noreferrer"
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
              Quiero esta casa →
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
