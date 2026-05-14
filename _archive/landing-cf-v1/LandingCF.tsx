'use client'

/**
 * components/landing/LandingCF.tsx
 *
 * Landing genérica de ConstruirFácil. Renderiza dos variantes (B2B y B2C)
 * con el mismo layout: 5 items con chevron a la izquierda + panel grande a
 * la derecha que muestra el título por default y el body del item activo.
 *
 * Interacción:
 *   - Desktop (hover capability): mouseenter activa, mouseleave desactiva
 *     (vuelve al título). Más fluido para exploración.
 *   - Mobile / touch: tap toggle. Sin hover, el panel se "queda" en el
 *     último item tocado hasta que toques otro o el item activo.
 *
 * Detección via `matchMedia('(hover: hover) and (pointer: fine)')`. iPads
 * con trackpad cuentan como hover; iPhones puros no.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LandingContent } from '@/lib/content/landing-cf'
// CSS importado directo desde el componente — más confiable que @import en
// globals.css (que requiere que todas las reglas vivan antes del @import).
import '@/app/landing-cf.css'

interface Props {
  content: LandingContent
}

// Velocidad del typewriter del título (ms por caracter). 60ms × ~47 chars =
// ~2820ms. Después de eso hay una pausa breve antes de arrancar los items.
const TYPEWRITER_MS = 60
// Espera total antes de que arranque el stagger de items. Suficiente para
// que el typewriter termine + una pausa contemplativa antes de seguir.
const ITEMS_START_AFTER_MS = 3300
// Delay entre items: chico para que "casi carguen todos juntos" como pidió
// el user. Combinado con duración larga por item (2.8s en CSS) crea la
// cascada donde un item ya está apareciendo cuando el anterior empieza a
// apagarse.
const STAGGER_MS = 90

export default function LandingCF({ content }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [isHoverable, setIsHoverable] = useState(false)
  const [typedTitle, setTypedTitle] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setIsHoverable(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsHoverable(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Typewriter del título al primer mount. Si el user ya está
  // interactuando con un item, el título igual está oculto — no afecta.
  useEffect(() => {
    setTypedTitle('')
    const text = content.title
    let i = 0
    const id = window.setInterval(() => {
      i++
      setTypedTitle(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, TYPEWRITER_MS)
    return () => window.clearInterval(id)
  }, [content.title])

  const activeItem =
    activeKey !== null
      ? content.items.find((i) => i.key === activeKey) ?? null
      : null

  const handleEnter = (key: string) => {
    if (isHoverable) setActiveKey(key)
  }
  const handleLeave = () => {
    if (isHoverable) setActiveKey(null)
  }
  const handleClick = (key: string) => {
    // En desktop también funciona el click (toggle); en mobile es el único
    // mecanismo. Si re-tocás el item activo, se cierra.
    setActiveKey((prev) => (prev === key ? null : key))
  }

  const otherVariantHref = content.variant === 'b2b' ? '/' : '/empresas'
  const otherVariantLabel =
    content.variant === 'b2b' ? 'Quiero Construir' : 'Soy Proveedor'

  return (
    <main className="cf-landing">
      {/* Top bar: link a la otra variante. Discreto, sin nav. */}
      <header className="cf-landing-topbar">
        <Link href={otherVariantHref} className="cf-landing-flip">
          {otherVariantLabel} →
        </Link>
      </header>

      <section className="cf-landing-hero">
        <div className="cf-landing-grid">
          {/* IZQ: 5 items con flecha roja (asset compartido con el catálogo).
              onMouseLeave en el container (no en cada item) para que el
              "salto" entre items no resetee. */}
          <nav
            className="cf-landing-nav"
            onMouseLeave={handleLeave}
            aria-label="Beneficios"
          >
            {content.items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                className={`cf-landing-item${
                  activeKey === it.key ? ' is-active' : ''
                }`}
                // Stagger: cada item entra con delay incremental. Se setea
                // como CSS var para que los hijos (label + flecha) compartan
                // el timing en sus respectivas animaciones.
                style={
                  {
                    '--cf-item-delay': `${
                      ITEMS_START_AFTER_MS + i * STAGGER_MS
                    }ms`,
                  } as React.CSSProperties
                }
                onMouseEnter={() => handleEnter(it.key)}
                onClick={() => handleClick(it.key)}
                aria-pressed={activeKey === it.key}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Flecha-Roja.png"
                  alt=""
                  aria-hidden="true"
                  className="cf-landing-arrow"
                />
                <span className="cf-landing-item-label">{it.label}</span>
              </button>
            ))}
          </nav>

          {/* DER: panel + CTAs apilados verticalmente. CTAs viven dentro
              de esta columna para quedar alineados a la izquierda del
              título de arriba. */}
          <div className="cf-landing-right">
            <div className="cf-landing-panel">
              <h1
                className={`cf-landing-title${activeItem ? ' is-hidden' : ''}`}
                aria-label={content.title}
              >
                {typedTitle}
                {/* Cursor titilante al final del texto tipeado. Solo visible
                    mientras el título está activo (sin item hover). */}
                <span className="cf-landing-cursor" aria-hidden="true" />
              </h1>
              {activeItem && (
                <div className="cf-landing-detail">
                  {/* No repetimos el label acá — ya vive en la flecha de la
                      izquierda, mostrarlo de nuevo era redundante. */}
                  <p className="cf-landing-detail-body">{activeItem.body}</p>
                </div>
              )}
            </div>

            {/* CTAs alineados al inicio de la columna (=alineados con el
                título arriba). Primary toma ~50% del ancho. */}
            <div className="cf-landing-ctas">
              <Link
                href={content.primaryCta.href}
                className="cf-landing-cta cf-landing-cta-primary"
              >
                {content.primaryCta.label}
                <span aria-hidden="true"> →</span>
              </Link>
              {content.secondaryCta && (
                <Link
                  href={content.secondaryCta.href}
                  className="cf-landing-cta cf-landing-cta-secondary"
                >
                  {content.secondaryCta.label}
                  <span aria-hidden="true"> →</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer con el logo CF grande (incluye los 6 círculos coloridos
          como parte del PNG) */}
      <footer className="cf-landing-footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cf_logo.png"
          alt="ConstruirFácil.com"
          className="cf-landing-logo"
        />
      </footer>
    </main>
  )
}
