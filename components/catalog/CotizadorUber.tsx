'use client'

/**
 * components/catalog/CotizadorUber.tsx
 *
 * Selector "Uber": el cliente elige el trade-off precio↔tiempo (3 tramos).
 * Cada tramo muestra el PRECIO USD final = basePrice × (1 + modifier_pct).
 *
 * Antes mostrábamos la cuota mensual, pero acceder al crédito depende de
 * los bancos, anticipo y precalificación del cliente — prometer una cuota
 * era engañoso. El precio USD por tramo es la información honesta: cuánto
 * cuesta la casa según cuánto estás dispuesto a esperar.
 *
 * Sin precio base (modelo o SC sin precio cargado) → "Consultar" por tramo.
 *
 * Cálculo client-side con función pura (applyTierModifier). El CTA lleva
 * a /cotizar (cierra el embudo). Datos: lib/content/cotizador-data.ts.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { applyTierModifier } from '@/lib/pricing/cuota'
import { track } from '@/lib/track/client'
import type { CotizadorTier } from '@/lib/content/cotizador-data'

function fmtUsd(n: number): string {
  return 'USD ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function CotizadorUber({
  tiers,
  basePriceUsd,
  caveatHtml,
  ctaHref = '/cotizar',
  context,
  hideCta = false,
  onTierChange,
}: {
  tiers: CotizadorTier[]
  basePriceUsd: number | null
  caveatHtml: string | null
  ctaHref?: string
  context?: {
    model?: string
    variante?: string | null
    sistema?: string | null
  }
  /** En modal el CTA lo da el form de abajo — acá sólo plan + cuota. */
  hideCta?: boolean
  /** Notifica al padre qué tramo está elegido (key + label + precio ya
   *  modificado). Lo usan las modales para que "Quiero esta casa" lleve el
   *  precio del tramo seleccionado y no el base. */
  onTierChange?: (tier: {
    key: string
    label: string
    priceUsd: number | null
  }) => void
}) {
  const ordered = useMemo(
    () => [...tiers].sort((a, b) => a.sort_order - b.sort_order),
    [tiers],
  )
  const defaultIdx = Math.max(
    0,
    ordered.findIndex((t) => t.highlighted),
  )
  const [sel, setSel] = useState(defaultIdx)
  const tier = ordered[sel] ?? ordered[0]

  /** Precio USD por tramo = basePrice × (1 + modifier_pct/100). Si no hay
   *  basePrice (modelo sin precio cargado), devolvemos null para mostrar
   *  "Consultar" en la card en lugar de un número inventado. */
  const priceByTierKey = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const t of ordered) {
      out[t.key] =
        basePriceUsd != null
          ? Math.round(applyTierModifier(basePriceUsd, t.price_modifier_pct))
          : null
    }
    return out
  }, [ordered, basePriceUsd])

  // Avisar al padre el tramo elegido (mount + cada cambio de selección o de
  // precio base). `priceByTierKey` ya trae el precio con el modificador
  // aplicado, así "Quiero esta casa" usa ese y no el base.
  useEffect(() => {
    const t = ordered[sel]
    if (!t) return
    onTierChange?.({
      key: t.key,
      label: t.label,
      priceUsd: priceByTierKey[t.key] ?? null,
    })
  }, [sel, ordered, priceByTierKey, onTierChange])

  if (ordered.length === 0) return null

  return (
    <div className="cf-uber">
      <p className="cf-st-section-label">Elegí tu plan</p>

      <div className="cf-uber-tiers" role="group" aria-label="Plan">
        {ordered.map((t, i) => {
          const tierPrice = priceByTierKey[t.key]
          return (
            <button
              key={t.key}
              type="button"
              className={`cf-uber-tier${i === sel ? ' is-selected' : ''}${
                t.highlighted ? ' is-featured' : ''
              }`}
              aria-pressed={i === sel}
              onClick={() => setSel(i)}
            >
              {t.highlighted && <span className="cf-uber-badge">Recomendado</span>}
              <span className="cf-uber-tier-label">{t.label}</span>
              {t.lead_time_label && (
                <span className="cf-uber-tier-sub">{t.lead_time_label}</span>
              )}
              <span className="cf-uber-tier-price">
                {tierPrice != null ? fmtUsd(tierPrice) : 'Consultar'}
              </span>
            </button>
          )
        })}
      </div>

      {!hideCta && (
        <Link
          href={ctaHref}
          className="cf-uber-cta"
          onClick={() =>
            track('cotizar_open', {
              source: 'cotizador_uber',
              tier: tier?.key,
              price_usd: priceByTierKey[tier?.key ?? ''] ?? null,
              ...context,
            })
          }
        >
          Quiero esta casa →
        </Link>
      )}

      {caveatHtml && (
        <div
          className="cf-uber-caveat"
          // Saneado server-side al guardar (admin/cotizador → sanitizeRichTextOrNull).
          dangerouslySetInnerHTML={{ __html: caveatHtml }}
        />
      )}
    </div>
  )
}
