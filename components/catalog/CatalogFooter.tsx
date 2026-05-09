'use client'

/**
 * components/catalog/CatalogFooter.tsx
 *
 * Cierre del catálogo en 3 capas:
 *
 *   1. Cierre editorial (olive sage full-bleed) — eyebrow + título + body
 *      + CTAs primario/secundario.
 *
 *   2. Mini marquee continuo — mismo skin que el HeroRow pero más bajo
 *      (~260px). Mezcla 3 tipos de cards en loop infinito, pausa en hover:
 *        - Trust: "50.000 m²", "100% financiado", "Garantía", "Fábrica propia".
 *        - CTA: "Pedí cotización", "Hablá con un asesor".
 *        - Modelos featured: foto + nombre, click → abre el modelo.
 *
 *   3. Footer estándar — logo, contacto, links, social, legal.
 *
 * El marquee reusa la misma técnica del HeroRow (rAF + duplicado de slides)
 * para que el wraparound sea invisible.
 */

import { useEffect, useRef, useState } from 'react'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import type { Marca } from '@/types/database'
import { buildCotizarMailto } from '@/lib/cta/mailto'
import { Ruler, BadgeCheck, ShieldCheck, Factory, Globe, Phone } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Trust cards
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_CARDS: {
  id: string
  icon: typeof Ruler
  number: string
  unit: string
  label: string
}[] = [
  {
    id: 'm2',
    icon: Ruler,
    number: '50.000',
    unit: 'm²',
    label: 'construidos por nuestro equipo',
  },
  {
    id: 'financiado',
    icon: BadgeCheck,
    number: '100%',
    unit: '',
    label: 'financiado, accesible para tu familia',
  },
  {
    id: 'garantia',
    icon: ShieldCheck,
    number: 'Garantía',
    unit: '',
    label: 'Hausind sobre cada vivienda',
  },
  {
    id: 'fabrica',
    icon: Factory,
    number: 'Fábrica',
    unit: '',
    label: 'propia, sin intermediarios',
  },
]

interface CatalogFooterProps {
  featuredModels: CatalogModel[]
  /** Marcas aprobadas — se renderean como cards anchas en el marquee. */
  marcas?: Marca[]
  /** Callback cuando se hace click en una card de modelo. */
  onOpenModel?: (model: CatalogModel) => void
}

export default function CatalogFooter({
  featuredModels,
  marcas = [],
  onOpenModel,
}: CatalogFooterProps) {
  return (
    <footer className="cf-footer">
      {/* ── Capa 1: Cierre editorial (olive sage) ────────────────────── */}
      <section className="cf-footer-cierre">
        <div className="cf-footer-cierre-inner">
          <p className="cf-footer-cierre-eyebrow">¿No encontraste lo que buscás?</p>
          <h2 className="cf-footer-cierre-title">
            Diseñamos tu casa<br />a medida.
          </h2>
          <p className="cf-footer-cierre-body">
            Nuestro equipo te ayuda a definir la casa que mejor se adapta a tu
            terreno, presupuesto y estilo de vida. Sin compromiso, te
            respondemos siempre.
          </p>
          <div className="cf-footer-cierre-ctas">
            <a className="cf-footer-cta-primary" href={buildCotizarMailto()}>
              Cotizar →
            </a>
            {/* "Hablar con un asesor" oculto temporalmente. */}
          </div>
        </div>
      </section>

      {/* ── Capa 2: Mini marquee ─────────────────────────────────────── */}
      <FooterMarquee
        featuredModels={featuredModels}
        marcas={marcas}
        onOpenModel={onOpenModel}
      />

    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterMarquee — capa 2
// ─────────────────────────────────────────────────────────────────────────────

type MarqueeCard =
  | { kind: 'cta-cotizar' }
  | { kind: 'trust'; trust: (typeof TRUST_CARDS)[number] }
  | { kind: 'model'; model: CatalogModel }
  | { kind: 'brand'; brand: Marca }

function buildMarqueeCards(
  featured: CatalogModel[],
  marcas: Marca[],
): MarqueeCard[] {
  // Patrón visual: intercalar tamaños distintos para dar dinámica.
  // cta (compacto) → trust (cuadrado) → model (rectangular) →
  // brand (ancho, hero) → trust → model → ...
  const cards: MarqueeCard[] = []
  cards.push({ kind: 'cta-cotizar' })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[0] })
  if (featured[0]) cards.push({ kind: 'model', model: featured[0] })
  // La card de marca va aprox al "centro" del set para que aparezca
  // visible al cargar (la 4ta posición en el track).
  if (marcas[0]) cards.push({ kind: 'brand', brand: marcas[0] })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[1] })
  if (featured[1]) cards.push({ kind: 'model', model: featured[1] })
  if (featured[2]) cards.push({ kind: 'model', model: featured[2] })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[2] })
  if (featured[3]) cards.push({ kind: 'model', model: featured[3] })
  // Resto de marcas si hay más de una.
  for (const b of marcas.slice(1)) cards.push({ kind: 'brand', brand: b })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[3] })
  if (featured[4]) cards.push({ kind: 'model', model: featured[4] })
  for (const m of featured.slice(5)) cards.push({ kind: 'model', model: m })
  return cards
}

function FooterMarquee({
  featuredModels,
  marcas,
  onOpenModel,
}: {
  featuredModels: CatalogModel[]
  marcas: Marca[]
  onOpenModel?: (model: CatalogModel) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const cards = buildMarqueeCards(featuredModels, marcas)

  // rAF marquee: scrollLeft +0.7 px/frame, wraparound invisible cuando pasa
  // del inicio del set B (= inicio de la 2ª copia de las cards).
  useEffect(() => {
    const SPEED = 0.7
    let rafId = 0
    const tick = () => {
      const track = trackRef.current
      if (!track) return
      if (!pausedRef.current) {
        const firstSlide = track.children[0] as HTMLElement | undefined
        const setBStart = track.children[cards.length] as HTMLElement | undefined
        if (firstSlide && setBStart) {
          const loopAmount = setBStart.offsetLeft - firstSlide.offsetLeft
          let next = track.scrollLeft + SPEED
          if (loopAmount > 0 && next >= setBStart.offsetLeft) {
            next -= loopAmount
          }
          track.scrollLeft = next
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [cards.length])

  const renderCard = (card: MarqueeCard, keyPrefix: string, idx: number) => {
    const key = `${keyPrefix}-${idx}-${card.kind}`
    if (card.kind === 'cta-cotizar') {
      return (
        <a
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-cta cf-footer-marquee-card-cta-primary"
          href={buildCotizarMailto()}
        >
          <span className="cf-footer-marquee-card-eyebrow">Acción</span>
          <span className="cf-footer-marquee-card-title">Cotizar</span>
          <span className="cf-footer-marquee-card-arrow">→</span>
        </a>
      )
    }
    if (card.kind === 'trust') {
      const Icon = card.trust.icon
      return (
        <div
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-trust"
        >
          <Icon className="cf-footer-marquee-card-icon" />
          <span className="cf-footer-marquee-card-trust-num">
            {card.trust.number}
            {card.trust.unit && (
              <span className="cf-footer-marquee-card-trust-unit">
                {card.trust.unit}
              </span>
            )}
          </span>
          <span className="cf-footer-marquee-card-trust-lbl">
            {card.trust.label}
          </span>
        </div>
      )
    }
    if (card.kind === 'brand') {
      const b = card.brand
      const websiteHref = b.website_url
      const phoneHref = b.phone ? `tel:${b.phone.replace(/\s+/g, '')}` : null
      return (
        <div
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-brand"
        >
          <div className="cf-footer-marquee-card-brand-head">
            {b.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.logo_url}
                alt={`Logo de ${b.name}`}
                className="cf-footer-marquee-card-brand-logo"
              />
            ) : (
              <span className="cf-footer-marquee-card-brand-name">
                {b.name}
              </span>
            )}
            <span className="cf-footer-marquee-card-eyebrow">
              {b.city ?? 'Marca verificada'}
            </span>
          </div>
          <div className="cf-footer-marquee-card-brand-links">
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="cf-footer-marquee-card-brand-link"
              >
                <Globe className="cf-footer-marquee-card-brand-icon" />
                <span>Web</span>
              </a>
            )}
            {phoneHref && (
              <a
                href={phoneHref}
                className="cf-footer-marquee-card-brand-link"
              >
                <Phone className="cf-footer-marquee-card-brand-icon" />
                <span>{b.phone}</span>
              </a>
            )}
          </div>
        </div>
      )
    }

    // model
    const m = card.model
    return (
      <button
        key={key}
        type="button"
        onClick={() => onOpenModel?.(m)}
        className="cf-footer-marquee-card cf-footer-marquee-card-model"
        style={{
          backgroundImage: m.cover_url ? `url('${m.cover_url}')` : undefined,
          backgroundColor: m.cover_url ? undefined : m.lqip_color,
        }}
      >
        <div className="cf-footer-marquee-card-model-overlay">
          <span className="cf-footer-marquee-card-model-linea">
            {displayLinea(m.linea)}
          </span>
          <span className="cf-footer-marquee-card-model-name">
            {m.display_name}
          </span>
        </div>
      </button>
    )
  }

  return (
    <section
      className="cf-footer-marquee"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <header className="cf-footer-marquee-header">
        <p className="cf-footer-marquee-eyebrow">Más para vos</p>
        <h3 className="cf-footer-marquee-title">
          Modelos destacados, datos clave y formas de avanzar
        </h3>
      </header>
      <div ref={trackRef} className="cf-footer-marquee-track">
        {cards.map((c, i) => renderCard(c, 'a', i))}
        {cards.map((c, i) => renderCard(c, 'b', i))}
      </div>
    </section>
  )
}
