'use client'

/**
 * components/catalog/CatalogPromoBanner.tsx
 *
 * Banner promocional reusable inspirado en los pasos del producto (ELEGÍ /
 * COTIZÁ / POSTULÁ / DISFRUTÁ). Diseño: eyebrow uppercase a la izquierda +
 * flecha blanca + copy bold a la derecha, fondo color sólido CF
 * (rojo/celeste/amarillo/verde), border-radius 15px.
 *
 * Usado en:
 *   - Hero del catálogo (filtro Lote como pregunta visible)
 *   - Banners intermedios entre filas (refuerzo contextual)
 *   - Banners por provincia (#13 estado open/closed/sin programa)
 *
 * Cuando exista el admin (post-sprint), los campos `eyebrow`, `body`,
 * `color`, `cta_label`, `cta_action` se editarán desde una sola tabla.
 */

import { useEffect, useState } from 'react'

export type CatalogPromoColor = 'red' | 'cyan' | 'yellow' | 'green'

const COLOR_PALETTE: Record<
  CatalogPromoColor,
  { bg: string; fg: string; eyebrowFg: string }
> = {
  red:    { bg: '#ff003d', fg: '#ffffff', eyebrowFg: 'rgba(255,255,255,0.92)' },
  cyan:   { bg: '#26b6cf', fg: '#ffffff', eyebrowFg: 'rgba(255,255,255,0.92)' },
  yellow: { bg: '#f4a72b', fg: '#ffffff', eyebrowFg: 'rgba(255,255,255,0.92)' },
  green:  { bg: '#3aa087', fg: '#ffffff', eyebrowFg: 'rgba(255,255,255,0.92)' },
}

interface BannerActionButton {
  /** Texto del CTA (ej. "Tengo lote propio"). */
  label: string
  /** Click handler — el caller decide qué hacer (setear filtro, abrir modal,
   *  navegar, etc.). */
  onClick: () => void
  /** Marcador visual cuando este es el CTA activo (la respuesta seleccionada
   *  por el usuario). Visualmente se pinta con outline en blanco. */
  active?: boolean
}

interface CatalogPromoBannerProps {
  eyebrow: string
  body: string
  color: CatalogPromoColor
  /** Opcional: uno o dos botones a la derecha (ej. "Sí" / "No"). Si no hay
   *  botones, el banner es solo display — el caller puede envolver el
   *  componente en un <button> para hacerlo clickeable entero. */
  actions?: BannerActionButton[]
  /** Modificador de presentación:
   *  - 'hero'   → grande, primer banner, pegado al sticky (no radius-top)
   *  - 'cohort' → slim, pegado al sticky con tratamiento visual del hero
   *               (margen lateral del sticky + radius solo abajo). Se usa
   *               para los strips de cohorte (Lote sí/no) que confirman
   *               la elección sin volver a interrumpir el flujo.
   *  - 'inline' → slim, flotante con radius completo. Va entre filas
   *               como banner aislado. */
  variant?: 'hero' | 'cohort' | 'inline'
  /** Animación de entrada — fade+slide-up. Default true. */
  animate?: boolean
}

export default function CatalogPromoBanner({
  eyebrow,
  body,
  color,
  actions,
  variant = 'hero',
  animate = true,
}: CatalogPromoBannerProps) {
  const palette = COLOR_PALETTE[color]
  const isHero = variant === 'hero'
  // 'cohort' comparte casi todo con 'inline' pero matchea el "peg al sticky"
  // del hero (sin radius-top, sin margen vertical superior, mismo gutter
  // lateral). Tipografía y padding chicos como inline — es un strip.
  const isCohort = variant === 'cohort'
  const isPegged = isHero || isCohort

  // Animación de entrada: arrancamos con opacity 0 + translate down, después
  // del primer paint flipeamos a 1 + translate 0. Sin librerías.
  const [mounted, setMounted] = useState(!animate)
  useEffect(() => {
    if (!animate) return
    const t = window.setTimeout(() => setMounted(true), 16)
    return () => window.clearTimeout(t)
  }, [animate])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isHero ? 24 : 18,
        // Hero alto; cohort/inline slim.
        padding: isHero ? '28px 32px' : '12px 22px',
        background: palette.bg,
        color: palette.fg,
        // Hero + cohort sin radius-top: se "conectan" con el sticky de
        // arriba (peg visual). Inline radius completo (banner aislado
        // entre filas).
        borderRadius: isPegged ? '0 0 15px 15px' : 15,
        // Sombra solo abajo en hero/cohort (refuerza el "cuelga del
        // sticky"). Inline sombra cerrada (banner flotante).
        boxShadow: isPegged
          ? '0 10px 20px rgba(0,0,0,0.08)'
          : '0 6px 24px rgba(0,0,0,0.10)',
        // Inline acotado al ancho cómodo de lectura; hero/cohort full.
        maxWidth: isPegged ? undefined : 1280,
        // Hero/cohort: sin top, márgenes laterales matcheando el sticky
        // (clamp(24px, 5vw, 80px) → ver app/catalog.css .cf-sticky-filters).
        // Inline: aire vertical, centrado horizontal.
        margin: isPegged
          ? '0 clamp(24px, 5vw, 80px) 18px'
          : '20px auto',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 360ms ease-out, transform 360ms ease-out',
      }}
      role="region"
      aria-label={eyebrow}
    >
      <span
        style={{
          fontSize: isHero ? 14 : 12,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: palette.eyebrowFg,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {eyebrow}
      </span>
      <Arrow size={isHero ? 36 : 26} color={palette.fg} />
      <span
        style={{
          flex: 1,
          fontSize: isHero ? 22 : 16,
          fontWeight: 700,
          lineHeight: 1.25,
          color: palette.fg,
        }}
      >
        {body}
      </span>
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              style={{
                padding: isHero ? '10px 18px' : '7px 14px',
                background: a.active ? palette.fg : 'transparent',
                color: a.active ? palette.bg : palette.fg,
                border: `1.5px solid ${palette.fg}`,
                borderRadius: 999,
                fontSize: isHero ? 14 : 12,
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 180ms, color 180ms',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Arrow({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M14 9l11 9-11 9"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
