'use client'

/**
 * components/catalog/CotizadorUber.tsx
 *
 * Selector "Uber": el cliente elige el trade-off precio↔tiempo (3 tramos).
 * Cada tramo muestra el PRECIO USD REAL de su columna de house_catalog
 * (opción A): el SKU trae los 3 precios — lista / contado / pozo — y cada
 * tramo lee el suyo vía TIER_PRICE_SLOT. Ya no se aplica ningún modificador.
 *
 * Antes mostrábamos la cuota mensual, pero acceder al crédito depende de
 * los bancos, anticipo y precalificación del cliente — prometer una cuota
 * era engañoso. El precio USD por tramo es la información honesta: cuánto
 * cuesta la casa según cuánto estás dispuesto a esperar.
 *
 * Sin precio cargado para ese tramo → "Consultar" en esa card.
 *
 * El CTA lleva a /cotizar (cierra el embudo). Datos: cotizador-data.ts.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/track/client'
import {
  TIER_PRICE_SLOT,
  type CotizadorTier,
  type SkuPrices,
} from '@/lib/content/cotizador-data'

function fmtUsd(n: number): string {
  return 'USD ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function CotizadorUber({
  tiers,
  pricesUsd,
  caveatHtml,
  ctaHref = '/cotizar',
  context,
  hideCta = false,
  onTierChange,
}: {
  tiers: CotizadorTier[]
  /** Los 3 precios del SKU. Cada tramo lee el suyo vía TIER_PRICE_SLOT. */
  pricesUsd: SkuPrices
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

  /** Precio USD por tramo = la columna real del SKU que le toca a ese tramo
   *  (TIER_PRICE_SLOT). Sin precio cargado para esa columna → null →
   *  "Consultar" en la card, en lugar de un número inventado. La clave
   *  primitiva `pricesKey` mantiene el memo estable cuando los valores no
   *  cambian (pricesUsd es un objeto nuevo en cada render del padre). */
  const pricesKey = `${pricesUsd.lista}|${pricesUsd.contado}|${pricesUsd.pozo}`
  const priceByTierKey = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const t of ordered) {
      const slot = TIER_PRICE_SLOT[t.key]
      const p = slot ? pricesUsd[slot] : null
      out[t.key] = p != null ? Math.round(p) : null
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, pricesKey])

  // Avisar al padre el tramo elegido (mount + cada cambio de selección o de
  // precio). Dependemos de primitivas (key/label/precio) para no disparar
  // el efecto —y el setState del padre— en cada render.
  const selTier = ordered[sel]
  const selPrice = selTier ? priceByTierKey[selTier.key] ?? null : null
  useEffect(() => {
    if (!selTier) return
    onTierChange?.({ key: selTier.key, label: selTier.label, priceUsd: selPrice })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selTier?.key, selTier?.label, selPrice, onTierChange])

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
