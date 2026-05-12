'use client'

/**
 * components/SiteHeader.tsx
 *
 * Header sticky del sitio: logo HAUSIND a la izquierda (clickeable → /)
 * + logo ConstruirFácil a la derecha. Fondo blanco, padding generoso.
 */

import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="cf-site-header">
      <Link href="/" aria-label="Hausind — Volver al inicio" className="cf-site-header-hausind-link">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Hausind-Logo.png"
          alt="HAUSIND — La construcción inteligente"
          className="cf-site-header-hausind"
        />
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cf_logo_gris.png"
        alt="ConstruirFácil"
        className="cf-site-header-cf"
      />
    </header>
  )
}
