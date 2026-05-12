'use client'

/**
 * components/LandingHeader.tsx
 *
 * Header de la landing pública (/). Logo Hausind a la izquierda + CTA
 * "Ver catálogo" a la derecha. Transparente sobre el hero al inicio;
 * cuando el user scrollea pasa a blanco con backdrop-blur + borde.
 *
 * Para /catalogo seguimos usando SiteHeader (Hausind + CF, contexto
 * agregador).
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`cf-landing-header${scrolled ? ' cf-landing-header-scrolled' : ''}`}
      style={{ zIndex: 9999 }}
    >
      <Link
        href="/"
        className="cf-landing-header-logo-link"
        aria-label="Hausind — Inicio"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Hausind-Logo.png"
          alt="HAUSIND — La construcción inteligente"
          className="cf-landing-header-hausind"
        />
      </Link>
      <Link href="/catalogo" className="cf-landing-header-cta">
        Ver catálogo
        <span aria-hidden="true">→</span>
      </Link>
    </header>
  )
}
