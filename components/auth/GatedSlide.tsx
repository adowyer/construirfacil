'use client'

/**
 * components/auth/GatedSlide.tsx
 *
 * Wrapper para slides técnicos/sensibles (Planos, Axos, Tipología,
 * Comparativo, Equipamiento, Datos) que deben quedar gateados para
 * visitantes NO identificados.
 *
 * Comportamiento:
 *   - Identified → renderiza children normal.
 *   - NO identified → renderiza children con blur + overlay con CTA
 *     que dispara `onGateRequired` (CatalogPage abre el modal del gate).
 *
 * El blur (vs ocultar) genera FOMO: el visitante VE que hay contenido
 * y se motiva a registrarse en vez de irse.
 */

import type { ReactNode } from 'react'
import { useClientIdentified } from '@/lib/auth/use-client-identified'

interface GatedSlideProps {
  children: ReactNode
  /** Texto del overlay — describe brevemente QUÉ se desbloquea.
   *  Ej: "Registrate para ver los Planos arquitectónicos". */
  teaser: string
  /** Callback que dispara el modal del gate. Lo provee CatalogPage. */
  onGateRequired?: () => void
}

export default function GatedSlide({
  children,
  teaser,
  onGateRequired,
}: GatedSlideProps) {
  const { identified } = useClientIdentified()

  if (identified) return <>{children}</>

  return (
    <div className="cf-gated-slide">
      <div className="cf-gated-slide-content" aria-hidden="true">
        {children}
      </div>
      <div className="cf-gated-slide-overlay">
        <div className="cf-gated-slide-lock" aria-hidden="true">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="cf-gated-slide-teaser">{teaser}</p>
        <button
          type="button"
          onClick={onGateRequired}
          className="cf-gated-slide-cta"
        >
          Registrate gratis →
        </button>
        <p className="cf-gated-slide-fineprint">
          30 segundos. Solo te pedimos mail y nombre.
        </p>
      </div>
    </div>
  )
}
