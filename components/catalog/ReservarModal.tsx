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

import { useEffect, useRef, useState } from 'react'
import { LeadForm, type LeadFormCatalogContext } from '@/components/LeadForm'

export interface ReservarContext {
  model?: string
  variante?: string | null
  sistema?: string | null
  tier?: string | null
  priceUsd?: number | null
  /** Datos extra para persistir en `leads` + armar el email a la marca y
   *  el link de WA per-marca en la pantalla post-success. */
  marca_id?: string | null
  marca_name?: string | null
  marca_whatsapp?: string | null
  model_slug?: string | null
  style_name?: string | null
  tipologia_code_new?: string | null
  provincia_id?: string | null
  /** Contexto de lote del usuario (filtro StickyFilters). Se persiste con
   *  el lead para que ventas sepa si necesita ofrecer casa+lote. */
  tiene_lote?: 'si' | 'no' | null
  cuotaArs?: number | null
}

function contextToCatalog(ctx: ReservarContext): LeadFormCatalogContext {
  return {
    marca_id: ctx.marca_id,
    marca_name: ctx.marca_name,
    marca_whatsapp: ctx.marca_whatsapp,
    model_slug: ctx.model_slug,
    style_name: ctx.style_name,
    tipologia_code_new: ctx.tipologia_code_new,
    variante: ctx.variante,
    sistema_constructivo: ctx.sistema,
    provincia_id: ctx.provincia_id,
    tiene_lote: ctx.tiene_lote ?? null,
    precio_desde_usd: ctx.priceUsd ?? null,
    cuota_ars: ctx.cuotaArs ?? null,
  }
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

  // Después de que el LeadForm avisa onSuccess, cambiamos eyebrow + title
  // del modal — el "Contactanos / Dejanos tus datos" sonaba como si todavía
  // no se hubiera enviado.
  const [submitted, setSubmitted] = useState(false)
  // Reseteamos el flag cuando se vuelve a abrir el modal (otro modelo, etc).
  useEffect(() => {
    if (open) setSubmitted(false)
  }, [open])

  const resolvedEyebrow = submitted
    ? 'Gracias por contactarnos'
    : (eyebrow ?? (hasContext ? 'Quiero esta casa' : 'Contactanos'))
  const resolvedTitle = submitted
    ? null
    : (title ?? 'Dejanos tus datos y te contactamos')
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
        {resolvedTitle && (
          <h3 className="cf-reservar-modal-title">{resolvedTitle}</h3>
        )}
        {!submitted && context.model && (
          <p className="cf-reservar-modal-detail">
            {[context.model, context.variante && `Variante ${context.variante}`, context.sistema]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {/* key={message}: el textarea de LeadForm usa defaultValue (no
            controlado), que se lee una sola vez al montar. LeadForm se monta
            con ReservarModal — antes de que el usuario elija variante/tramo.
            Cambiar el key lo remonta con el mensaje prefilled actualizado. */}
        <LeadForm
          key={message}
          defaultLocalidad={null}
          defaultMessage={message}
          variant="light"
          submitLabel={resolvedSubmitLabel}
          catalog={contextToCatalog(context)}
          onSuccess={() => setSubmitted(true)}
        />
      </div>
    </dialog>
  )
}
