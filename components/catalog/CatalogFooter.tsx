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
import { buildCotizarMailto, buildAsesorMailto } from '@/lib/cta/mailto'
import { Ruler, BadgeCheck, ShieldCheck, Factory } from 'lucide-react'

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
  /** Callback cuando se hace click en una card de modelo. */
  onOpenModel?: (model: CatalogModel) => void
}

export default function CatalogFooter({
  featuredModels,
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
              Pedir cotización →
            </a>
            <a className="cf-footer-cta-secondary" href={buildAsesorMailto()}>
              Hablar con un asesor
            </a>
          </div>
        </div>
      </section>

      {/* ── Capa 2: Mini marquee ─────────────────────────────────────── */}
      <FooterMarquee
        featuredModels={featuredModels}
        onOpenModel={onOpenModel}
      />

      {/* ── Capa 3: Footer estándar ──────────────────────────────────── */}
      <section className="cf-footer-base">
        <div className="cf-footer-base-grid">
          <div className="cf-footer-base-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cf_logo_gris.png"
              alt="ConstruirFácil"
              className="cf-footer-base-logo"
            />
            <p className="cf-footer-base-tag">
              Catálogo de casas prefabricadas con financiamiento accesible.
            </p>
          </div>

          <div className="cf-footer-base-col">
            <p className="cf-footer-base-col-title">Contacto</p>
            <ul className="cf-footer-base-col-list">
              <li>
                <a href="mailto:cotizar@hausind.com">cotizar@hausind.com</a>
              </li>
              <li>
                <a href="mailto:info@construirfacil.com">info@construirfacil.com</a>
              </li>
            </ul>
          </div>

          <div className="cf-footer-base-col">
            <p className="cf-footer-base-col-title">Empresa</p>
            <ul className="cf-footer-base-col-list">
              <li>Sobre nosotros</li>
              <li>Cómo trabajamos</li>
              <li>Sistema constructivo</li>
            </ul>
          </div>

          <div className="cf-footer-base-col">
            <p className="cf-footer-base-col-title">Legal</p>
            <ul className="cf-footer-base-col-list">
              <li>Términos y condiciones</li>
              <li>Política de privacidad</li>
            </ul>
          </div>
        </div>
        <div className="cf-footer-base-bottom">
          <span>© {new Date().getFullYear()} ConstruirFácil</span>
          <span className="cf-footer-base-bottom-sep">·</span>
          <span>Hausind® sistema constructivo</span>
        </div>
      </section>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterMarquee — capa 2
// ─────────────────────────────────────────────────────────────────────────────

type MarqueeCard =
  | { kind: 'cta-cotizar' }
  | { kind: 'cta-asesor' }
  | { kind: 'trust'; trust: (typeof TRUST_CARDS)[number] }
  | { kind: 'model'; model: CatalogModel }

function buildMarqueeCards(featured: CatalogModel[]): MarqueeCard[] {
  // Intercalar trust + cta + modelos para romper la repetición visual.
  const cards: MarqueeCard[] = []
  cards.push({ kind: 'cta-cotizar' })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[0] })
  if (featured[0]) cards.push({ kind: 'model', model: featured[0] })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[1] })
  if (featured[1]) cards.push({ kind: 'model', model: featured[1] })
  cards.push({ kind: 'cta-asesor' })
  if (featured[2]) cards.push({ kind: 'model', model: featured[2] })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[2] })
  if (featured[3]) cards.push({ kind: 'model', model: featured[3] })
  cards.push({ kind: 'trust', trust: TRUST_CARDS[3] })
  if (featured[4]) cards.push({ kind: 'model', model: featured[4] })
  // Si hay más featured, los apendeamos sin alternar (no es crítico).
  for (const m of featured.slice(5)) cards.push({ kind: 'model', model: m })
  return cards
}

function FooterMarquee({
  featuredModels,
  onOpenModel,
}: {
  featuredModels: CatalogModel[]
  onOpenModel?: (model: CatalogModel) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const cards = buildMarqueeCards(featuredModels)

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
          <span className="cf-footer-marquee-card-title">Pedir cotización</span>
          <span className="cf-footer-marquee-card-arrow">→</span>
        </a>
      )
    }
    if (card.kind === 'cta-asesor') {
      return (
        <a
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-cta cf-footer-marquee-card-cta-secondary"
          href={buildAsesorMailto()}
        >
          <span className="cf-footer-marquee-card-eyebrow">Asesoramiento</span>
          <span className="cf-footer-marquee-card-title">Hablar con un asesor</span>
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
