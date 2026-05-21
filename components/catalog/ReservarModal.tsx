'use client'

/**
 * components/catalog/ReservarModal.tsx
 *
 * Modal "Reservar esta casa" — abre el LeadForm con el contexto de la
 * selección (modelo + variante + SC + plan) prefilleado en el campo
 * "Contanos qué buscás" para que el usuario no escriba todo de nuevo.
 *
 * Usa `<dialog>` nativo (top layer del browser) → no se ve afectado por
 * transforms/overflow de ancestros, igual que DeliveryConditionsModal.
 */

import { useEffect, useRef } from 'react'
import { LeadForm } from '@/components/LeadForm'

export interface ReservarContext {
  model?: string
  variante?: string | null
  sistema?: string | null
  tier?: string | null
  priceUsd?: number | null
}

function buildPrefilledMessage(ctx: ReservarContext): string {
  const parts: string[] = []
  if (ctx.model) parts.push(`Modelo: ${ctx.model}`)
  if (ctx.variante) parts.push(`Variante ${ctx.variante}`)
  if (ctx.sistema) parts.push(`Sistema: ${ctx.sistema}`)
  if (ctx.tier) parts.push(`Plan: ${ctx.tier}`)
  if (ctx.priceUsd != null) {
    parts.push(`Precio estimado: USD ${ctx.priceUsd.toLocaleString('es-AR')}`)
  }
  if (parts.length === 0) return ''
  return parts.join(' · ') + '\n\nQuiero que me contacten para avanzar con esta casa.'
}

export default function ReservarModal({
  open,
  onClose,
  context,
}: {
  open: boolean
  onClose: () => void
  context: ReservarContext
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

  const message = buildPrefilledMessage(context)

  return (
    <dialog
      ref={dialogRef}
      className="cf-reservar-modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      onClose={onClose}
    >
      <div className="cf-reservar-modal-inner">
        <button
          type="button"
          className="cf-reservar-modal-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        <p className="cf-reservar-modal-eyebrow">Quiero que me contacten</p>
        <h3 className="cf-reservar-modal-title">
          Dejanos tus datos y te contactamos
        </h3>
        {context.model && (
          <p className="cf-reservar-modal-detail">
            {[context.model, context.variante && `Variante ${context.variante}`, context.sistema]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <LeadForm
          defaultLocalidad={null}
          defaultMessage={message}
          variant="light"
        />
      </div>
    </dialog>
  )
}
