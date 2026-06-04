'use client'

/**
 * components/catalog/CatalogGridPromoCard.tsx
 *
 * Card editorial grande (672x420, glass overlay sobre foto de fondo) que va
 * al inicio del grid del catálogo según cohorte tieneLote:
 *
 *   tieneLote='no' → propuesta Casa+Lote con financiación + 2 CTAs
 *   tieneLote='si' → refuerzo de financiación + 1 CTA
 *
 * Reemplazó al strip slim 'inline' que flotaba mal entre filas. El visual es
 * más editorial (card grande con foto) para que el contexto Casa+Lote /
 * financiación se sienta como producto, no como banner intermedio.
 */

import React from 'react'

interface CatalogGridPromoCardAction {
  label: string
  onClick: () => void
}

interface CatalogGridPromoCardProps {
  /** Pill verde uppercase arriba del título. */
  eyebrow: string
  /** Heading grande (opcional). Sin title la card tira directo al body
   *  con tamaño similar al de un h2 — usado en la variant 'si' donde el
   *  copy es una única frase larga. */
  title?: string
  /** Párrafo descriptivo. */
  body: string
  /** Imagen de fondo (path relativo a /public). Default: la imagen
   *  editorial de Casa+Lote (estilo bosque con tarjeta). */
  bgImage?: string
  /** 1 o 2 CTAs. El primero se renderea en verde sólido (primary), el
   *  segundo (si hay) en outline blanco (secondary). */
  actions: CatalogGridPromoCardAction[]
}

export default function CatalogGridPromoCard({
  eyebrow,
  title,
  body,
  bgImage = '/casa-lote-bg.png',
  actions,
}: CatalogGridPromoCardProps) {
  return (
    <div className="cf-promo-card-wrapper">
      <div
        className="cf-promo-card-container"
        style={{ backgroundImage: `url('${bgImage}')` }}
      >
        <div className="cf-promo-glass-card">
          <span className="cf-promo-glass-eyebrow">{eyebrow}</span>
          {title && <h2 className="cf-promo-glass-title">{title}</h2>}
          <p className="cf-promo-glass-body">{body}</p>
          <div className="cf-promo-glass-actions">
            {actions.map((action, i) => (
              <button
                key={action.label}
                type="button"
                className={
                  i === 0
                    ? 'cf-promo-glass-btn'
                    : 'cf-promo-glass-btn cf-promo-glass-btn-secondary'
                }
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick()
                }}
              >
                {action.label} &rarr;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
