'use client'

/**
 * components/catalog/DeliveryConditionsModal.tsx
 *
 * Pill "Condiciones de Entrega" + modal con el texto (HTML saneado server,
 * render con .cf-richtext).
 *
 * variant:
 *  - 'gallery'    → pill IN-FLOW (se monta dentro de .cf-pn-gallery-top, al
 *                   lado del label "EXTERIORES" → alineado por el flex). El
 *                   modal se abre CONTENIDO en la foto (absolute, cubre solo
 *                   el panel .cf-pn — los offsets negativos cancelan el
 *                   padding 40/56 del overlay). Tarjeta blanca, texto negro.
 *  - 'standalone' → pill absolute arriba-izq; modal fixed (la página
 *                   /models/[slug] no tiene ancestro con transform).
 */

import { useEffect, useState } from 'react'

export default function DeliveryConditionsModal({
  html,
  variant = 'standalone',
}: {
  html: string
  variant?: 'gallery' | 'standalone'
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const isGallery = variant === 'gallery'

  const pillStyle: React.CSSProperties = isGallery
    ? {
        // En la galería el pill fluye dentro de .cf-pn-gallery-top (flex,
        // space-between) → queda alineado con el label "EXTERIORES".
        position: 'relative',
        zIndex: 2,
      }
    : {
        position: 'absolute',
        top: 18,
        left: 18,
        zIndex: 6,
      }

  // El backdrop del modal. En galería: absolute inset:0 → el containing
  // block es el padding box del ancestro posicionado (.cf-pn-gallery-overlay,
  // que es inset:0 de .cf-pn) → cubre EXACTAMENTE la foto. En standalone:
  // fixed a viewport (esa página no tiene ancestro con transform).
  const backdropStyle: React.CSSProperties = isGallery
    ? { position: 'absolute', inset: 0, zIndex: 30 }
    : { position: 'fixed', inset: 0, zIndex: 100 }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...pillStyle,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: '#0a0a0a',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: 'none',
          borderRadius: 999,
          padding: '8px 16px',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
        }}
      >
        Condiciones de Entrega
        <span aria-hidden="true" style={{ opacity: 0.55 }}>→</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Condiciones de Entrega"
          onClick={() => setOpen(false)}
          style={{
            ...backdropStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isGallery ? '28px' : '5vh 20px',
            background: 'rgba(10,10,10,0.34)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '97%',
              maxHeight: '100%',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 14,
              padding: '40px 40px 44px',
              color: '#1a1a1a',
              fontFamily: 'var(--font-geist), sans-serif',
              boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{
                position: 'absolute',
                top: 14,
                right: 16,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                lineHeight: 1,
                color: 'rgba(0,0,0,0.45)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>

            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: 'rgba(0,0,0,0.45)',
                marginBottom: 18,
              }}
            >
              Condiciones de Entrega
            </p>

            <div
              className="cf-richtext cf-delivery-conditions"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      )}
    </>
  )
}
