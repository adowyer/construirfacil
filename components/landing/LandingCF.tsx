'use client'

/**
 * components/landing/LandingCF.tsx
 *
 * Landing v2 de ConstruirFácil (B2C en /, B2B en /empresas). Comparte el
 * mismo layout entre ambas variantes — solo cambia copy.
 *
 * Estructura (scroll vertical, NO single-screen como la v1 que se sentía
 * "sitio en construcción"):
 *
 *   1. HERO full-viewport
 *      - Slideshow fade entre 4 fotos editoriales (/public/home/{1,3,4,7}.jpeg)
 *      - Logo CF arriba a la izquierda + link a la variante alterna
 *      - Headline sobreimpreso grande, centrado
 *
 *   2. BODY editorial (fondo blanco, columna centrada estilo catálogo)
 *      - Título "La manera más inteligente y fácil de Construir"
 *      - "Three chips" → grid de 5 cards con los beneficios del catálogo
 *      - Sección Mac mockup + foto del catálogo encima (espera PNG del user)
 *
 *   3. FOOTER institucional
 *      - Logos partners (Link / AD / Marketeam)
 *      - Copyright + links Privacidad / Términos
 *
 * Versión anterior archivada en _archive/landing-cf-v1/.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LandingContent } from '@/lib/content/landing-cf'
import '@/app/landing-cf.css'

const HERO_IMAGES = [
  '/home/1.jpeg',
  '/home/3.jpeg',
  '/home/4.jpeg',
  '/home/7.jpeg',
]
const SLIDE_INTERVAL_MS = 5500

interface Props {
  content: LandingContent
}

export default function LandingCF({ content }: Props) {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveSlide((s) => (s + 1) % HERO_IMAGES.length)
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  const otherVariantHref = content.variant === 'b2b' ? '/' : '/empresas'
  const otherVariantLabel =
    content.variant === 'b2b' ? 'Quiero Construir' : 'Soy Proveedor'

  // Copy del hero — varía según B2C/B2B. Lo dejamos hardcoded acá para
  // iterar rápido; si crece, mover a lib/content/landing-cf.ts.
  const heroHeadline =
    content.variant === 'b2c' ? (
      <>
        La casa que querés,
        <br />
        al precio que necesitás.
      </>
    ) : (
      <>
        Tu marca,
        <br />
        frente al mercado más grande.
      </>
    )

  return (
    <main className="cf-l">
      {/* ════════════════════════════════════════════════════════════════
          HERO full-viewport con slideshow fade
          ════════════════════════════════════════════════════════════════ */}
      <section className="cf-l-hero">
        {/* Slideshow background: 4 capas con fade entre ellas via opacity. */}
        <div className="cf-l-hero-slides" aria-hidden="true">
          {HERO_IMAGES.map((src, i) => (
            <div
              key={src}
              className={`cf-l-hero-slide${
                i === activeSlide ? ' is-active' : ''
              }`}
              style={{ backgroundImage: `url('${src}')` }}
            />
          ))}
        </div>

        {/* Overlay oscuro para que el texto blanco sea legible sobre las fotos */}
        <div className="cf-l-hero-overlay" aria-hidden="true" />

        {/* Topbar dentro del hero: logo CF a la izquierda + flip variant */}
        <header className="cf-l-topbar">
          <Link href="/" aria-label="ConstruirFácil — Inicio" className="cf-l-logo-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cf_logo_gris.png"
              alt="ConstruirFácil"
              className="cf-l-logo"
            />
          </Link>
          <Link href={otherVariantHref} className="cf-l-flip">
            {otherVariantLabel} <span aria-hidden="true">→</span>
          </Link>
        </header>

        {/* Headline sobreimpreso */}
        <h1 className="cf-l-hero-headline">{heroHeadline}</h1>

        {/* Dots indicators */}
        <div className="cf-l-hero-dots" role="tablist">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeSlide}
              aria-label={`Imagen ${i + 1} de ${HERO_IMAGES.length}`}
              className={`cf-l-hero-dot${
                i === activeSlide ? ' is-active' : ''
              }`}
              onClick={() => setActiveSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          BODY editorial — fondo blanco, columna centrada
          ════════════════════════════════════════════════════════════════ */}
      <section className="cf-l-body">
        <div className="cf-l-container">
          <h2 className="cf-l-body-title">{content.title}</h2>

          {/* "Three chips" — grid de cards con los beneficios. 5 items, en
              desktop 3+2 o auto-fit; en mobile colapsa a 1 columna. */}
          <div className="cf-l-chips">
            {content.items.map((it) => (
              <article key={it.key} className="cf-l-chip">
                <h3 className="cf-l-chip-title">{it.label}</h3>
                <p className="cf-l-chip-body">{it.body}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Sección Mac mockup — width full bleed (rompe el container) para que
            la pantalla del Mac sea protagonista. Texto a la izquierda. */}
        <div className="cf-l-mac-section">
          <div className="cf-l-mac-grid">
            <div className="cf-l-mac-copy">
              <h3 className="cf-l-mac-title">
                {content.variant === 'b2c'
                  ? 'El catálogo más inteligente del mercado.'
                  : 'Mostrá tu inventario en el catálogo más visitado.'}
              </h3>
              <p className="cf-l-mac-body">
                {content.variant === 'b2c'
                  ? 'Filtrá por estilo, tamaño y dormitorios. Compará marcas. Encontrá tu casa ideal — toda la oferta del país en un solo lugar.'
                  : 'Tu marca al lado de las mejores del país. Tu catálogo, ordenado por IA según la búsqueda de cada cliente. Más conversión, menos ciclo.'}
              </p>
              <Link
                href={content.primaryCta.href}
                className="cf-l-mac-cta"
              >
                {content.primaryCta.label}
                <span aria-hidden="true"> →</span>
              </Link>
            </div>

            <div className="cf-l-mac-frame">
              {/* Placeholder hasta que llegue el PNG del MacBook. El frame
                  CSS simula el bezel oscuro + pantalla. Cuando esté el PNG,
                  reemplazar este div por <img src="/macbook-frame.png" /> y
                  posicionar la foto del catálogo encima vía absolute. */}
              <div className="cf-l-mac-screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/home/1.jpeg"
                  alt="Catálogo ConstruirFácil"
                  className="cf-l-mac-screen-img"
                />
              </div>
              <div className="cf-l-mac-base" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FOOTER institucional — logos + copyright + links legales
          ════════════════════════════════════════════════════════════════ */}
      <footer className="cf-l-footer">
        <div className="cf-l-footer-inner">
          <div className="cf-l-footer-logos">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Link.png" alt="Link" className="cf-l-footer-logo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Ad.png" alt="AD" className="cf-l-footer-logo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Marketeam.png"
              alt="Marketeam"
              className="cf-l-footer-logo"
            />
          </div>
          <div className="cf-l-footer-meta">
            <span className="cf-l-footer-copy">
              © {new Date().getFullYear()} ConstruirFácil. Todos los derechos
              reservados.
            </span>
            <nav className="cf-l-footer-links">
              <a href="/privacidad">Política de Privacidad</a>
              <span aria-hidden="true">·</span>
              <a href="/terminos">Términos del Servicio</a>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  )
}
