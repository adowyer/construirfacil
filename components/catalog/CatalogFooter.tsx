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
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import { buildCotizarMailto, buildAsesorMailto } from '@/lib/cta/mailto'
import { useInViewport } from '@/lib/hooks/useInViewport'
import { Ruler, BadgeCheck, ShieldCheck, Factory, Globe, Phone } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CfMarqueeLogo — logo animado de ConstruirFácil en la card del marquee.
// Swappea el GIF por el PNG estático cuando está fuera de viewport: los GIFs
// consumen CPU continuo decodificando frames, incluso scrolleados afuera. El
// swap libera ese laburo y, al volver, retoma la animación desde frame 0.
// ─────────────────────────────────────────────────────────────────────────────
function CfMarqueeLogo() {
  const { ref, inView } = useInViewport<HTMLImageElement>({
    initialInView: false, // el footer arranca debajo del fold
  })
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={ref}
      src={inView ? '/ConstruirFacil.gif' : '/cf_logo_gris.png'}
      alt="ConstruirFácil"
      className="cf-footer-marquee-card-cf-logo"
    />
  )
}

// Map de icon_key (DB) → componente lucide-react. Default factory.
const ICON_BY_KEY: Record<string, typeof Ruler> = {
  ruler: Ruler,
  'badge-check': BadgeCheck,
  'shield-check': ShieldCheck,
  factory: Factory,
}

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
  /** Cards editables del marquee, por marca. Si la marca primaria tiene cards
   *  cargadas, se usan; sino fallback a TRUST_CARDS hardcoded. */
  footerCardsByMarca?: Record<string, FooterCardRow[]>
  /** Callback cuando se hace click en una card de modelo. */
  onOpenModel?: (model: CatalogModel) => void
}

export default function CatalogFooter({
  featuredModels,
  marcas = [],
  footerCardsByMarca = {},
  onOpenModel,
}: CatalogFooterProps) {
  return (
    <footer className="cf-footer">
      {/* ── Capa "cemento": cierre con CTAs, ancho restringido (no full-bleed),
          sin copy descriptivo. ─────────────────────────────────────────── */}
      <section className="cf-footer-cierre cf-footer-cierre-narrow">
        <div className="cf-footer-cierre-inner">
          <p className="cf-footer-cierre-eyebrow">¿No encontraste lo que buscás?</p>
          <h2 className="cf-footer-cierre-title">
            Diseñamos tu casa<br />a medida.
          </h2>
          <div className="cf-footer-cierre-ctas">
            <a className="cf-footer-cta-primary" href={buildCotizarMailto()}>
              Contactanos →
            </a>
            <a className="cf-footer-cta-secondary" href={buildAsesorMailto()}>
              Conversar con Ximia
            </a>
          </div>
        </div>
      </section>

      {/* ── Capa "principal": marquee de cards (CF + Marca + trust + Hablemos).
          Sin header (eyebrow/título arriba quitados a pedido del user). */}
      <FooterMarquee
        featuredModels={featuredModels}
        marcas={marcas}
        footerCardsByMarca={footerCardsByMarca}
        onOpenModel={onOpenModel}
      />

      {/* ── Capa institucional: logos partner + copyright + legales ──── */}
      <FooterInstitucional />

    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterInstitucional — capa pequeña al pie del catálogo, estilo Ximia.ai.
// Logos Link / AD / Marketeam + copyright + links Privacidad/Términos.
// ─────────────────────────────────────────────────────────────────────────────

function FooterInstitucional() {
  return (
    <section className="cf-footer-inst">
      <div className="cf-footer-inst-inner">
        <div className="cf-footer-inst-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Link.png" alt="Link" className="cf-footer-inst-logo" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Ad.png" alt="AD" className="cf-footer-inst-logo" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Marketeam.png" alt="Marketeam" className="cf-footer-inst-logo" />
        </div>
        <div className="cf-footer-inst-meta">
          <span className="cf-footer-inst-copy">
            © {new Date().getFullYear()} ConstruirFácil. Todos los derechos reservados.
          </span>
          <nav className="cf-footer-inst-links">
            <a href="/privacidad">Política de Privacidad</a>
            <span aria-hidden="true">·</span>
            <a href="/terminos">Términos del Servicio</a>
          </nav>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterMarquee — capa 2
// ─────────────────────────────────────────────────────────────────────────────

type MarqueeCard =
  | { kind: 'cf' }
  | { kind: 'cta-hablemos' }
  | { kind: 'trust'; trust: (typeof TRUST_CARDS)[number] }
  | { kind: 'db_trust'; card: FooterCardRow }
  | { kind: 'model'; model: CatalogModel }
  | { kind: 'brand'; brand: Marca }

function findTrust(id: string) {
  return TRUST_CARDS.find((t) => t.id === id)
}

function buildMarqueeCards(
  _featured: CatalogModel[],
  marcas: Marca[],
  footerCardsByMarca: Record<string, FooterCardRow[]>,
): MarqueeCard[] {
  // Orden fijo a pedido del user (item 18):
  //   CF → Marca → cards 3-6 (Garantía/100%/Fábrica/50.000) → Hablemos.
  // Cards 3-6 son trust cards: si la marca primaria tiene cards en DB,
  // las usamos; sino fallback al hardcode.
  const cards: MarqueeCard[] = []
  cards.push({ kind: 'cf' })
  if (marcas[0]) cards.push({ kind: 'brand', brand: marcas[0] })

  const primary = marcas[0]
  const dbCards = primary ? footerCardsByMarca[primary.id] ?? [] : []
  if (dbCards.length > 0) {
    for (const c of dbCards) {
      cards.push({ kind: 'db_trust', card: c })
    }
  } else {
    const garantia = findTrust('garantia')
    if (garantia) cards.push({ kind: 'trust', trust: garantia })
    const financiado = findTrust('financiado')
    if (financiado) cards.push({ kind: 'trust', trust: financiado })
    const fabrica = findTrust('fabrica')
    if (fabrica) cards.push({ kind: 'trust', trust: fabrica })
    const m2 = findTrust('m2')
    if (m2) cards.push({ kind: 'trust', trust: m2 })
  }

  cards.push({ kind: 'cta-hablemos' })
  // Marcas extra al final si hay más de una.
  for (const b of marcas.slice(1)) cards.push({ kind: 'brand', brand: b })
  return cards
}

function FooterMarquee({
  featuredModels,
  marcas,
  footerCardsByMarca,
  onOpenModel,
}: {
  featuredModels: CatalogModel[]
  marcas: Marca[]
  footerCardsByMarca: Record<string, FooterCardRow[]>
  onOpenModel?: (model: CatalogModel) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const cards = buildMarqueeCards(featuredModels, marcas, footerCardsByMarca)

  // Pausamos el rAF cuando el track no está en viewport — el footer queda
  // fuera de pantalla mientras el user navega el catálogo, no hay razón para
  // gastar ciclos animando el marquee.
  const [trackInView, setTrackInView] = useState(false)
  useEffect(() => {
    const el = trackRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setTrackInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => setTrackInView(entry.isIntersecting),
      { threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // rAF marquee: scrollLeft +0.7 px/frame, wraparound invisible cuando pasa
  // del inicio del set B (= inicio de la 2ª copia de las cards).
  useEffect(() => {
    if (!trackInView) return // pausado fuera de viewport
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
  }, [cards.length, trackInView])

  const renderCard = (card: MarqueeCard, keyPrefix: string, idx: number) => {
    const key = `${keyPrefix}-${idx}-${card.kind}`
    if (card.kind === 'cf') {
      return (
        <a
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-cf"
          href="/"
        >
          <div className="cf-footer-marquee-card-cf-head">
            <CfMarqueeLogo />
          </div>
          <span className="cf-footer-marquee-card-cf-tagline">
            Encontrá la casa que mejor se adapta a vos.
          </span>
        </a>
      )
    }
    if (card.kind === 'cta-hablemos') {
      return (
        <a
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-cta cf-footer-marquee-card-cta-primary"
          href={buildAsesorMailto()}
        >
          <span className="cf-footer-marquee-card-eyebrow">Acción</span>
          <span className="cf-footer-marquee-card-title">Hablemos</span>
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
    if (card.kind === 'db_trust') {
      const Icon = ICON_BY_KEY[card.card.icon_key] ?? Factory
      return (
        <div
          key={key}
          className="cf-footer-marquee-card cf-footer-marquee-card-trust"
        >
          <Icon className="cf-footer-marquee-card-icon" />
          <span className="cf-footer-marquee-card-trust-num">
            {card.card.number_text}
            {card.card.unit_text && (
              <span className="cf-footer-marquee-card-trust-unit">
                {card.card.unit_text}
              </span>
            )}
          </span>
          <span className="cf-footer-marquee-card-trust-lbl">
            {card.card.label_text}
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
      <div ref={trackRef} className="cf-footer-marquee-track">
        {cards.map((c, i) => renderCard(c, 'a', i))}
        {cards.map((c, i) => renderCard(c, 'b', i))}
      </div>
    </section>
  )
}
