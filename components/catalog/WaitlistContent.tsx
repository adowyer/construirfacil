'use client'

/**
 * components/catalog/WaitlistContent.tsx
 *
 * Form de "te avisamos cuando lleguemos" para los flujos de provincia
 * excluida. Usos:
 *
 *  - CotizarCenteredModal con excluded=true (visitante hizo Cotizar / Ver
 *    precio sobre una casa que la marca no construye en su provincia).
 *  - ProvinciaConfirmModal (onboarding) cuando el visitante eligió una
 *    provincia donde NINGUNA marca recommendable opera todavía. En este
 *    caso el contexto de casa viene vacío (model_slug, style_name, etc.).
 *
 * Estados:
 *  1) Identificado previo (cookie cf_session) → short-circuit: mensaje
 *     "ya te tenemos anotado" sin re-pedir nombre/email/WA. Evita pedir
 *     dos veces los mismos datos a un visitante que ya volvió.
 *  2) state.ok=true después del submit → confirmación.
 *  3) Inicial → form con nombre + email + WA (opcional).
 *
 * El lead se persiste con lead_type='waitlist_provincia'. Migración 0061
 * deja la columna en la tabla `leads`. El email a la marca + el cliente
 * sale por sendLeadEmail (templates engagement).
 */

import { useActionState, useEffect, useRef, useState } from 'react'
import { submitLead, type LeadResult } from '@/app/cotizar/actions'
import { getAsesorHref } from '@/lib/cta/mailto'
import { XIMIA_ENABLED } from '@/lib/feature-flags'
import { track } from '@/lib/track/client'
import {
  refetchClientStatus,
  useClientIdentified,
} from '@/lib/auth/use-client-identified'

export type WaitlistContext = {
  /** Nombre human-readable de la marca para el copy. Null en onboarding
   *  (todavía no eligió una marca particular). */
  marca?: string | null
  marca_id?: string | null
  provincia_id?: string | null
  /** Nombre human-readable de la provincia para el copy. */
  provincia_name?: string | null
  tiene_lote?: 'si' | 'no' | null
  model_slug?: string | null
  style_name?: string | null
  tipologia_code_new?: string | null
  linea?: string | null
}

interface Props {
  context: WaitlistContext
  /** Línea "Estás viendo: Casa X — Marca, Línea" para la modal del cotizador.
   *  En onboarding viene vacío (no hay casa concreta). */
  detail?: string
  onClose: () => void
}

export function WaitlistContent({ context, detail, onClose }: Props) {
  const [state, formAction, isPending] = useActionState<LeadResult, FormData>(
    submitLead,
    { ok: false, error: null },
  )
  const [phoneFilled, setPhoneFilled] = useState(false)
  const pathRef = useRef<HTMLInputElement>(null)
  const clientStatus = useClientIdentified()
  // Solo cf_session cuenta como "ya dejó datos" — un usuario verificado por
  // OTP que nunca mandó un lead NO debería ver el short-circuit. Mismo
  // criterio que LeadForm.
  const existingLeadEmail = clientStatus.leadEmail

  useEffect(() => {
    if (pathRef.current) pathRef.current.value = window.location.pathname
  }, [])

  useEffect(() => {
    if (state.ok) {
      track('lead_waitlist_submit_ok', {
        marca_id: context.marca_id ?? null,
        provincia_id: context.provincia_id ?? null,
      })
      refetchClientStatus().catch(() => {})
    }
  }, [state.ok, context.marca_id, context.provincia_id])

  const marcaLabel = context.marca ?? 'la marca elegida'
  const zoneLabel = context.provincia_name ?? 'tu zona'

  // ── Estado 1: ya dejó datos antes (cookie cf_session) ───────────────────
  if (existingLeadEmail) {
    return (
      <>
        <p className="cf-cotizar-modal-eyebrow">Disponibilidad</p>
        <h3 className="cf-cotizar-modal-title">Ya te tenemos anotado</h3>
        {detail && <p className="cf-cotizar-modal-detail">{detail}</p>}
        <div className="cf-cotizar-modal-disclaimer">
          <p>
            Como ya nos dejaste tus datos ({existingLeadEmail}), vas a ser de
            los primeros en enterarte cuando {context.marca ? <strong>{marcaLabel}</strong> : 'alguna marca'}{' '}
            abra cupo en {zoneLabel}.
          </p>
        </div>
        <div className="cf-cotizar-modal-ctas">
          {XIMIA_ENABLED && (
            <a
              href={getAsesorHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="cf-cotizar-panel-cta-secondary"
              onClick={() =>
                track('asesor_click', {
                  source: 'waitlist_already_identified',
                  ...context,
                })
              }
            >
              Conversar con Ximia
            </a>
          )}
          <button
            type="button"
            className="cf-cotizar-panel-cta-primary"
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </>
    )
  }

  // ── Estado 2: submit ok recién ─────────────────────────────────────────
  if (state.ok) {
    return (
      <>
        <p className="cf-cotizar-modal-eyebrow">¡Listo!</p>
        <h3 className="cf-cotizar-modal-title">
          Te avisamos en cuanto lleguemos a tu provincia
        </h3>
        <div className="cf-cotizar-modal-disclaimer">
          <p>
            Anotamos tu interés en <strong>{marcaLabel}</strong>. Cuando abramos
            cupo en {zoneLabel} te contactamos primero por email.
            {phoneFilled
              ? ' También te avisaremos por WhatsApp si hay promociones de lanzamiento.'
              : ''}
          </p>
        </div>
        <div className="cf-cotizar-modal-ctas">
          {XIMIA_ENABLED && (
            <a
              href={getAsesorHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="cf-cotizar-panel-cta-secondary"
              onClick={() =>
                track('asesor_click', {
                  source: 'waitlist_success',
                  ...context,
                })
              }
            >
              Conversar con Ximia
            </a>
          )}
          <button
            type="button"
            className="cf-cotizar-panel-cta-primary"
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </>
    )
  }

  // ── Estado 3: form inicial ─────────────────────────────────────────────
  // Onboarding (sin marca) vs detalle de casa (con marca): el onboarding usa
  // un mensaje forward-compat ("no todas las marcas operan") que no afirma
  // "nadie opera" — pronto entran más marcas al catálogo y queremos invitar
  // a explorar igual. El detalle por casa sigue siendo específico a esa
  // marca/línea (mensaje cerrado, accurate).
  return (
    <>
      <p className="cf-cotizar-modal-eyebrow">Disponibilidad</p>
      <h3 className="cf-cotizar-modal-title">
        {context.linea
          ? 'Esta línea aún no opera en tu provincia'
          : `No todas las marcas operan en ${zoneLabel}`}
      </h3>
      {detail && <p className="cf-cotizar-modal-detail">{detail}</p>}

      <div className="cf-cotizar-modal-disclaimer">
        <p>
          {context.marca ? (
            <>
              Por ahora <strong>{marcaLabel}</strong> no construye en{' '}
              {zoneLabel}. Dejanos tu contacto y te avisamos por email cuando
              abramos cupo en tu zona.
            </>
          ) : (
            <>
              Podés explorar el catálogo igual — en cada casa vas a ver si esa
              marca opera en {zoneLabel}. Si querés, dejanos tus datos y te
              avisamos por email cuando se sumen nuevos cupos en tu zona.
            </>
          )}
        </p>
      </div>

      <form action={formAction} style={{ display: 'block', marginTop: 4 }}>
        <input type="hidden" name="lead_type" value="waitlist_provincia" />
        <input type="hidden" name="marca_id" value={context.marca_id ?? ''} />
        <input
          type="hidden"
          name="provincia_id"
          value={context.provincia_id ?? ''}
        />
        {context.tiene_lote && (
          <input type="hidden" name="tiene_lote" value={context.tiene_lote} />
        )}
        <input type="hidden" name="model_slug" value={context.model_slug ?? ''} />
        <input type="hidden" name="style_name" value={context.style_name ?? ''} />
        <input
          type="hidden"
          name="tipologia_code_new"
          value={context.tipologia_code_new ?? ''}
        />
        <input ref={pathRef} type="hidden" name="path" defaultValue="" />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#888',
                marginBottom: 4,
                fontWeight: 600,
              }}
              htmlFor="waitlist-name"
            >
              Nombre
            </label>
            <input
              id="waitlist-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                color: '#0a0a0a',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#888',
                marginBottom: 4,
                fontWeight: 600,
              }}
              htmlFor="waitlist-email"
            >
              Email
            </label>
            <input
              id="waitlist-email"
              name="email"
              type="email"
              required
              pattern="[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}"
              title="Ingresá un email válido (ej: nombre@dominio.com)"
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                color: '#0a0a0a',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 4 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#888',
              marginBottom: 4,
              fontWeight: 600,
            }}
            htmlFor="waitlist-phone"
          >
            WhatsApp{' '}
            <span style={{ textTransform: 'none', fontWeight: 400, color: '#aaa' }}>
              (opcional)
            </span>
          </label>
          <input
            id="waitlist-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 ..."
            onChange={(e) => setPhoneFilled(e.target.value.trim().length > 0)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              color: '#0a0a0a',
            }}
          />
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: '#666',
              lineHeight: 1.45,
            }}
          >
            Si nos dejás tu WhatsApp también te avisamos de{' '}
            <strong>promociones de lanzamiento</strong> en tu zona.
          </p>
        </div>

        {state.error && (
          <p
            style={{
              margin: '10px 0 0',
              padding: '8px 12px',
              background: '#fdecec',
              border: '1px solid #f3b9b9',
              borderRadius: 8,
              color: '#9a0e0e',
              fontSize: 13,
            }}
          >
            {state.error}
          </p>
        )}

        <div className="cf-cotizar-modal-ctas" style={{ marginTop: 14 }}>
          {XIMIA_ENABLED && (
            <a
              href={getAsesorHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="cf-cotizar-panel-cta-secondary"
              onClick={() =>
                track('asesor_click', {
                  source: 'waitlist_form',
                  ...context,
                })
              }
            >
              Conversar con Ximia
            </a>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="cf-cotizar-panel-cta-primary"
            style={isPending ? { opacity: 0.6, cursor: 'wait' } : undefined}
          >
            {isPending ? 'Enviando…' : 'Sumarme a la lista →'}
          </button>
        </div>
      </form>
    </>
  )
}
