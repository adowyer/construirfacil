'use client'

/**
 * components/catalog/CotizadorUber.tsx
 *
 * Selector "Uber": el cliente elige el trade-off precio↔tiempo (3 tramos) y
 * la cuota mensual estimada se recalcula en vivo. No muestra el precio
 * absoluto (la casa es a medida) — muestra la CUOTA, que es el gancho real
 * y honesto. Sin T.C./ancla/precio → degrada: NUNCA un número inventado.
 *
 * Cálculo client-side con funciones PURAS (lib/pricing/cuota). El CTA lleva
 * a /cotizar (cierra el embudo). Datos: lib/content/cotizador-data.ts.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { applyTierModifier, pickBestCuotaArs } from '@/lib/pricing/cuota'
import type { CuotaProduct } from '@/lib/pricing/cuota'
import { track } from '@/lib/track/client'
import type { CotizadorTier } from '@/lib/content/cotizador-data'

function fmtArs(n: number): string {
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function CotizadorUber({
  tiers,
  basePriceUsd,
  fxRef,
  cuotaProducts,
  caveatHtml,
  ctaHref = '/cotizar',
  context,
  hideCta = false,
}: {
  tiers: CotizadorTier[]
  basePriceUsd: number | null
  fxRef: number | null
  cuotaProducts: CuotaProduct[]
  caveatHtml: string | null
  ctaHref?: string
  context?: {
    model?: string
    variante?: string | null
    sistema?: string | null
  }
  /** En modal el CTA lo da el form de abajo — acá sólo plan + cuota. */
  hideCta?: boolean
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

  const cuotaInfo = useMemo(() => {
    if (!tier || basePriceUsd == null) return null
    return pickBestCuotaArs({
      priceUsd: applyTierModifier(basePriceUsd, tier.price_modifier_pct),
      fxRef,
      products: cuotaProducts,
    })
  }, [tier, basePriceUsd, fxRef, cuotaProducts])
  const cuotaArs = cuotaInfo?.cuotaArs ?? null
  const downPaymentArs = cuotaInfo?.downPaymentArs ?? 0

  if (ordered.length === 0) return null

  return (
    <div className="cf-uber">
      <p className="cf-st-section-label">Elegí tu plan</p>

      <div className="cf-uber-tiers" role="group" aria-label="Plan">
        {ordered.map((t, i) => (
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
          </button>
        ))}
      </div>

      <div className="cf-uber-readout">
        {cuotaArs != null ? (
          <>
            <span className="cf-uber-from">Podés tenerla desde</span>
            <span className="cf-uber-amount">
              {fmtArs(cuotaArs)}
              <span className="cf-uber-per"> / mes</span>
            </span>
            <span className="cf-uber-note">
              {downPaymentArs > 0
                ? `Adelanto estimado: ${fmtArs(downPaymentArs)} · cuota inicial UVA`
                : 'Cuota inicial estimada · ajustable por UVA'}
            </span>
          </>
        ) : (
          <>
            <span className="cf-uber-from">Tu casa, a tu medida</span>
            <span className="cf-uber-soft">
              Coordinamos la cuota según el plan y tu precalificación.
            </span>
          </>
        )}
      </div>

      {!hideCta && (
        <Link
          href={ctaHref}
          className="cf-uber-cta"
          onClick={() =>
            track('cotizar_open', {
              source: 'cotizador_uber',
              tier: tier?.key,
              cuota_ars: cuotaArs,
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
