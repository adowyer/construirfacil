'use client'

/**
 * components/onboarding/ProvinciaConfirmModal.tsx
 *
 * Modal bloqueante (con skip) de primer ingreso para confirmar / elegir
 * provincia. Tres estados:
 *
 *   • Sugerencia geo: arriba aparece "¿Estás en {nombre}?" con dos CTAs
 *     primarios (Sí / Otra provincia). Si el usuario clickea "Otra
 *     provincia", se expande el dropdown.
 *   • Picker: dropdown con dos optgroups (operativas / no operativas).
 *   • Waitlist: cuando confirmó una provincia donde NINGUNA marca opera,
 *     entra a la vista de "te avisamos cuando lleguemos" reutilizando el
 *     mismo form del cotizador excluded (componente WaitlistContent), pero
 *     sin contexto de casa (todavía no eligió una). Cerrar / submit commitea
 *     la provincia al provider para que el resto del catálogo la respete.
 *
 * "Más tarde" en los estados de elección cierra para esta sesión
 * (sessionStorage). Cookie persiste la elección por 1 año.
 */

import { useState } from 'react'
import type { ProvinciaRow } from '@/lib/supabase/queries/zones'
import { WaitlistContent } from '@/components/catalog/WaitlistContent'

interface Props {
  provincias: ProvinciaRow[]
  suggestedProvinciaId: string | null
  /** Provincias donde NINGUNA marca opera (van al optgroup "Aún no…"). */
  nonOperativeProvinciaIds: string[]
  /** Si está seteada, el modal arranca DIRECTO en vista waitlist (skip del
   *  picker). Se usa cuando el visitante ya eligió la provincia desde otro
   *  control (ej. StickyFilters) y necesitamos informarle que no operamos
   *  ahí — no tiene sentido pedirle que vuelva a elegirla. */
  initialWaitlistProvinciaId?: string | null
  onConfirm: (provinciaId: string) => void
  onSkip: () => void
}

export function ProvinciaConfirmModal({
  provincias,
  suggestedProvinciaId,
  nonOperativeProvinciaIds,
  initialWaitlistProvinciaId = null,
  onConfirm,
  onSkip,
}: Props) {
  const suggested =
    provincias.find((p) => p.id === suggestedProvinciaId) ?? null
  const [picking, setPicking] = useState(!suggested)
  const [pickedId, setPickedId] = useState<string>(suggestedProvinciaId ?? '')
  // ID que dispara la vista waitlist. Puede venir desde:
  //   1. El picker interno (visitante elige una no-op acá adentro).
  //   2. El padre via initialWaitlistProvinciaId (visitante ya cambió la
  //      provincia desde StickyFilters/otro control). Como el modal se monta
  //      condicionalmente (modalOpen en el provider), el useState inicial
  //      captura el valor correcto en cada nueva apertura.
  // El commit final (setear cookie + cerrar) sucede cuando el visitante
  // cierra el modal desde la vista waitlist (botón "Listo" o backdrop).
  const [waitlistProvinciaId, setWaitlistProvinciaId] = useState<string | null>(
    initialWaitlistProvinciaId,
  )

  const nonOpSet = new Set(nonOperativeProvinciaIds)
  const operativas = provincias.filter((p) => !nonOpSet.has(p.id))
  const noOperativas = provincias.filter((p) => nonOpSet.has(p.id))

  function commit(id: string) {
    if (nonOpSet.has(id)) {
      // No operativa → no cerramos, pasamos a la vista waitlist con la
      // misma modal. El commit del cookie sucede al cerrar desde waitlist.
      setWaitlistProvinciaId(id)
      return
    }
    onConfirm(id)
  }

  function closeWaitlist() {
    if (waitlistProvinciaId) onConfirm(waitlistProvinciaId)
  }

  function handleSubmitPicker() {
    if (!pickedId) return
    commit(pickedId)
  }

  // ── Vista 3: waitlist (provincia no operativa confirmada) ───────────────
  if (waitlistProvinciaId) {
    const provincia =
      provincias.find((p) => p.id === waitlistProvinciaId) ?? null
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-provincia-modal-title"
        className="cf-provincia-modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeWaitlist()
        }}
      >
        <div className="cf-provincia-modal-card cf-provincia-modal-card-wide">
          <button
            type="button"
            className="cf-cotizar-modal-close"
            onClick={closeWaitlist}
            aria-label="Cerrar"
          >
            ×
          </button>
          <WaitlistContent
            context={{
              provincia_id: waitlistProvinciaId,
              provincia_name: provincia?.name ?? null,
              // En onboarding no hay marca ni casa todavía. El lead queda
              // como "interés genérico por la provincia"; la calificación
              // por marca se hace después si el visitante engancha.
              marca: null,
              marca_id: null,
              linea: null,
              model_slug: null,
              style_name: null,
              tipologia_code_new: null,
              tiene_lote: null,
            }}
            onClose={closeWaitlist}
          />
        </div>
      </div>
    )
  }

  // ── Vista 1 / 2: sugerencia o picker ───────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-provincia-modal-title"
      className="cf-provincia-modal-backdrop"
    >
      <div className="cf-provincia-modal-card">
        <h2 id="cf-provincia-modal-title" className="cf-provincia-modal-title">
          {suggested && !picking
            ? `¿Estás en ${suggested.name}?`
            : 'Elegí tu provincia'}
        </h2>
        <p className="cf-provincia-modal-sub">
          La usamos para mostrarte precios reales, disponibilidad y financiación
          de tu zona.
        </p>

        {suggested && !picking ? (
          <div className="cf-provincia-modal-actions">
            <button
              type="button"
              className="cf-provincia-modal-btn cf-provincia-modal-btn-primary"
              onClick={() => commit(suggested.id)}
            >
              Sí, estoy en {suggested.name}
            </button>
            <button
              type="button"
              className="cf-provincia-modal-btn cf-provincia-modal-btn-secondary"
              onClick={() => {
                setPicking(true)
                setPickedId('')
              }}
            >
              Estoy en otra provincia
            </button>
          </div>
        ) : (
          <div className="cf-provincia-modal-pick">
            <label
              htmlFor="cf-provincia-modal-select"
              className="cf-provincia-modal-label"
            >
              Provincia
            </label>
            <select
              id="cf-provincia-modal-select"
              className="cf-provincia-modal-select"
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
            >
              <option value="">— Elegí tu provincia —</option>
              {operativas.length > 0 && (
                <optgroup label="Operamos en">
                  {operativas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {noOperativas.length > 0 && (
                <optgroup label="Aún no operamos">
                  {noOperativas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="cf-provincia-modal-actions">
              <button
                type="button"
                className="cf-provincia-modal-btn cf-provincia-modal-btn-primary"
                onClick={handleSubmitPicker}
                disabled={!pickedId}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="cf-provincia-modal-skip"
          onClick={onSkip}
        >
          Más tarde
        </button>
      </div>
    </div>
  )
}
