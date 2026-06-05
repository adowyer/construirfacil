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
import { XIMIA_ENABLED } from '@/lib/feature-flags'
import { track } from '@/lib/track/client'
import type { CotizadorData, SkuPrices } from '@/lib/content/cotizador-data'

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
  pricesUsd,
  context,
  systems = [],
  pricesForSC,
  offerForSC,
}: {
  open: boolean
  onClose: () => void
  cotizador: CotizadorData
  /** Los 3 precios del SKU de la variante elegida (SC del contexto). */
  pricesUsd: SkuPrices
  context: {
    model?: string
    variante?: string | null
    sistema?: string | null
    /** Datos extra para que el lead que el usuario eventualmente envíe desde
     *  el "Quiero esta casa" final llegue con marca, modelo, provincia, etc. */
    marca?: string | null
    marca_id?: string | null
    marca_whatsapp?: string | null
    model_slug?: string | null
    style_name?: string | null
    tipologia_code_new?: string | null
    provincia_id?: string | null
  }
  /** Sistemas constructivos disponibles para esta variante. Si llega vacío
   *  o con 1 solo elemento, no se muestra el selector (siguen pasando
   *  `pricesUsd` y `context.sistema` originales sin cambios). */
  systems?: string[]
  /** Resuelve los 3 precios para un SC dado. Permite al modal recalcular
   *  cuando el usuario cambia el pill de SC. Si no se provee, los precios
   *  quedan fijos en `pricesUsd`. */
  pricesForSC?: (sc: string | null) => SkuPrices
  /** Resuelve los datos de oferta del SKU para el SC seleccionado. Si está
   *  activa, los precios se aplican con descuento y aparece banner + tachado.
   *  Devolver `null` si no hay oferta para ese SC. */
  offerForSC?: (sc: string | null) => { pct: number; label: string } | null
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
  // Tramo elegido en el cotizador (key + label + precio ya modificado).
  // "Quiero esta casa" lo usa para llevar el precio del tramo, no el base.
  const [selectedTier, setSelectedTier] = useState<{
    key: string
    label: string
    priceUsd: number | null
  } | null>(null)

  // Selector de SC dentro del modal (movido desde el comparativo — feedback
  // SH 25). Default = el SC que vino del contexto, o el primero disponible.
  const [selectedSC, setSelectedSC] = useState<string | null>(
    context.sistema ?? systems[0] ?? null,
  )
  useEffect(() => {
    // Si el contexto cambia (ej. otra variante), resincronizar.
    setSelectedSC(context.sistema ?? systems[0] ?? null)
  }, [context.sistema, systems])

  // Precios base según SC seleccionado (si se pasó el helper). Fallback
  // a los pricesUsd originales.
  const basePrices: SkuPrices =
    pricesForSC && selectedSC != null ? pricesForSC(selectedSC) : pricesUsd

  // Oferta activa para el SC seleccionado: aplica el % de descuento a los 3
  // tramos y muestra banda arriba con el label + tachado del precio original.
  const offer = offerForSC ? offerForSC(selectedSC) : null
  const effectivePrices: SkuPrices = offer
    ? {
        lista: basePrices.lista != null ? basePrices.lista * (1 - offer.pct / 100) : null,
        contado: basePrices.contado != null ? basePrices.contado * (1 - offer.pct / 100) : null,
        pozo: basePrices.pozo != null ? basePrices.pozo * (1 - offer.pct / 100) : null,
      }
    : basePrices
  const fmt = (n: number | null | undefined) =>
    n == null ? null : `USD ${Math.round(n).toLocaleString('es-AR')}`

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
    tier: selectedTier?.label ?? null,
    priceUsd: selectedTier?.priceUsd ?? effectivePrices.lista ?? null,
    marca_id: context.marca_id ?? null,
    marca_name: context.marca ?? null,
    marca_whatsapp: context.marca_whatsapp ?? null,
    model_slug: context.model_slug ?? null,
    style_name: context.style_name ?? null,
    tipologia_code_new: context.tipologia_code_new ?? null,
    provincia_id: context.provincia_id ?? null,
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

          {offer && (
            <div style={{
              marginTop: 14,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'linear-gradient(90deg, #ff003d 0%, #d80035 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}>
              <span style={{
                background: '#fff',
                color: '#ff003d',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}>
                {offer.label} · −{offer.pct}%
              </span>
              <span style={{ fontSize: 13, opacity: 0.92 }}>
                Antes{' '}
                <span style={{ textDecoration: 'line-through', opacity: 0.75 }}>
                  {fmt(basePrices.contado) ?? fmt(basePrices.lista)}
                </span>
                {' · '}
                <strong>Ahora {fmt(effectivePrices.contado) ?? fmt(effectivePrices.lista)}</strong>
              </span>
            </div>
          )}

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
              pricesUsd={effectivePrices}
              caveatHtml={cotizador.caveatHtml}
              context={{ ...context, sistema: selectedSC }}
              hideCta
              onTierChange={setSelectedTier}
            />
          </div>

          <div className="cf-cotizar-panel-ctas">
            {XIMIA_ENABLED && (
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
            )}
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

          {/* Disclaimer educativo de Precios dinámicos. Va DESPUÉS de los
              botones para que los CTAs queden por encima del fold y los
              curiosos puedan scrollear para entender el modelo de precios. */}
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
              <strong>El precio se ajusta por &ldquo;tiempo&rdquo; y &ldquo;volumen&rdquo;.</strong>{' '}
              Creamos un exclusivo <strong>modelo de cotización colectiva por cupos</strong>{' '}
              que premia tu flexibilidad. Al organizar las obras por ubicación y volumen de
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
