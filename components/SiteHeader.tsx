'use client'

/**
 * components/SiteHeader.tsx
 *
 * Header sticky del sitio: logo HAUSIND a la izquierda + logo ConstruirFácil
 * a la derecha. Fondo blanco, padding generoso. Se queda pegado arriba
 * mientras se hace scroll en el catálogo.
 */

export default function SiteHeader() {
  return (
    <header className="cf-site-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Hausind-Logo.png"
        alt="HAUSIND — La construcción inteligente"
        className="cf-site-header-hausind"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cf_logo_gris.png"
        alt="ConstruirFácil"
        className="cf-site-header-cf"
      />
    </header>
  )
}
