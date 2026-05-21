'use client'

/**
 * components/catalog/ReservarModal.tsx
 *
 * Modal del LeadForm — dos modos:
 *
 * 1. CON contexto (modelo + variante + SC + plan): "Quiero esta casa". El
 *    LeadForm arranca con un mensaje prefilled describiendo la selección
 *    así el usuario no escribe todo de nuevo.
 *
 * 2. SIN contexto: modal genérico de contacto (reemplaza los mailto del
 *    catálogo público — footer, mid-CTA, Hablemos). El copy es
 *    parametrizable vía props (`eyebrow`, `title`).
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
  return parts.join(' · ') + '\n\nQuiero esta casa. Por favor, contáctenme para avanzar.'
}

export default function ReservarModal({
  open,
  onClose,
  context,
  eyebrow,
  title,
  submitLabel,
}: {
  open: boolean
  onClose: () => void
  context: ReservarContext
  /** Copy del eyebrow. Default = "Quiero esta casa" (modo con contexto) o
   *  "Contactanos" (modo genérico sin contexto). */
  eyebrow?: string
  /** Copy del título. Default = "Dejanos tus datos y te contactamos". */
  title?: string
  /** Texto del botón submit. Default = "Quiero esta casa →" (con contexto)
   *  o "Contactanos →" (sin contexto). */
  submitLabel?: string
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
  const hasContext = !!context.model

  const resolvedEyebrow =
    eyebrow ?? (hasContext ? 'Quiero esta casa' : 'Contactanos')
  const resolvedTitle = title ?? 'Dejanos tus datos y te contactamos'
  const resolvedSubmitLabel =
    submitLabel ?? (hasContext ? 'Quiero esta casa →' : 'Contactanos →')

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
        <p className="cf-reservar-modal-eyebrow">{resolvedEyebrow}</p>
        <h3 className="cf-reservar-modal-title">{resolvedTitle}</h3>
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
          submitLabel={resolvedSubmitLabel}
        />
      </div>
    </dialog>
  )
}
