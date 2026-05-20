'use client'

/**
 * components/catalog/DeliveryConditionsModal.tsx
 *
 * Pill "Detalles de la casa" + modal con el contenido de "Condiciones de
 * Entrega" (HTML saneado server, render con .cf-richtext).
 *
 * Diseño del pill: ícono "+" en círculo VERDE + texto (en ese orden) — mismo
 * lenguaje visual que el "Ver +" del listado (círculo rojo, ícono + + texto).
 *
 * El modal SIEMPRE se abre con `<dialog>.showModal()` → top layer del browser,
 * no se ve afectado por transforms/overflow de ancestros (la ficha colapsada
 * tiene `transform` en su row → un `position:fixed` ahí se vuelve "fixed
 * relativo al row", recortado, queda chiquito). El dialog elemento del DOM
 * vive en el top layer, fuera del flujo, así que cubre todo el viewport.
 *
 * variant:
 *  - 'gallery'    → pill in-flow dentro de .cf-pn-gallery-top (al lado del
 *                   label). Texto blanco, sombra.
 *  - 'standalone' → pill absolute arriba-izq de la página (model detail).
 *  - 'inline'     → pill inline para anclarlo dentro de columnas o headers
 *                   ya posicionados (Panel1Description, ficha colapsada).
 *                   Texto oscuro.
 */

import { useEffect, useRef, useState } from 'react'

function PlusIcon() {
  return (
    <svg
      className="cf-detalles-btn-plus-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function DeliveryConditionsModal({
  html,
  variant = 'standalone',
  label = 'Detalles de la casa',
}: {
  html: string
  variant?: 'gallery' | 'standalone' | 'inline'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  // Bloquear scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const wrapperClass = `cf-detalles-btn-wrap cf-detalles-btn-wrap--${variant}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cf-detalles-btn ${wrapperClass}`}
      >
        <span className="cf-detalles-btn-plus" aria-hidden="true">
          <PlusIcon />
        </span>
        <span className="cf-detalles-btn-label">{label}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="cf-detalles-modal"
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false)
        }}
        onClose={() => setOpen(false)}
      >
        <div className="cf-detalles-modal-inner">
          <button
            type="button"
            className="cf-detalles-modal-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            ×
          </button>
          <p className="cf-detalles-modal-eyebrow">{label}</p>
          <div
            className="cf-richtext cf-delivery-conditions"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </dialog>
    </>
  )
}
