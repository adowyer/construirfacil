'use client'

/**
 * components/catalog/CasaLoteSaberMasModal.tsx
 *
 * Modal educativo del filtro "Lote" — explica el diferenciador estructural
 * de ConstruirFácil: financiamos casa + lote en cuotas, incluso para quien
 * no tiene terreno propio. Se abre desde:
 *   - Banner educativo debajo de StickyFilters
 *   - (futuro) tooltip de pills de Lote
 *
 * Texto provisional, sujeto a revisión de stakeholders. La copy final
 * vendrá editable desde admin cuando se integre con `promo_messages`.
 */

import { useEffect, useRef } from 'react'

export default function CasaLoteSaberMasModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="cf-cotizar-modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      onClose={onClose}
    >
      <div className="cf-cotizar-modal-inner">
        <button
          type="button"
          className="cf-cotizar-modal-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>

        <p className="cf-cotizar-modal-eyebrow">Casa + Lote</p>
        <h3 className="cf-cotizar-modal-title">
          Tu casa, con o sin terreno
        </h3>

        <div className="cf-cotizar-modal-disclaimer">
          <p>
            En ConstruirFácil sumamos algo distinto: además de elegir tu casa,
            podés acceder a un <strong>terreno en uno de nuestros loteos
            asociados</strong>. Y lo más importante: te financiamos las dos cosas
            en cuotas.
          </p>
          <p>
            Aun si <strong>no tenés terreno hoy</strong>, podés empezar a
            construir tu casa en uno de nuestros desarrollos disponibles.
          </p>
          <p>
            Si elegís <strong>“Busco casa + lote”</strong> en los filtros, el
            catálogo te muestra los modelos disponibles en loteos de tu
            provincia. Si tenés terreno propio, elegí <strong>“Tengo lote”</strong>
            y vas a ver todos los modelos sin restricción.
          </p>
        </div>

        <div className="cf-cotizar-modal-ctas">
          <button
            type="button"
            className="cf-cotizar-panel-cta-primary"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  )
}
