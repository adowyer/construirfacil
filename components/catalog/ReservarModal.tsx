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
import { requestOTP, verifyOTP } from '@/app/(auth)/gate/actions'
import { useClientIdentified } from '@/lib/auth/use-client-identified'

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
  return parts.join(' · ') + '\n\nQuiero esta casa. Por favor, contactame para avanzar.'
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
  const [submitted, setSubmitted] = useState<null | {
    email: string
    name: string | null
  }>(null)
  // Guardamos el flag de "ya procesamos el success" para evitar disparar el
  // pedido de OTP dos veces: LeadForm llama `onSuccess` una vez cuando
  // `state.ok` cambia a true, y otra vez cuando `existingLeadEmail` se
  // popula tras el refetchClientStatus post-submit.
  const handledSuccessRef = useRef(false)
  // Counter que incrementa cada vez que el modal se abre. Se usa en el
  // `key` del LeadForm para forzar remount en cada apertura → `useActionState`
  // arranca en blanco y no arrastra errores del intento anterior (ej. si el
  // usuario cerró tras un fallo de Turnstile y volvió a abrir el modal, no
  // debería seguir viendo el banner rojo).
  const [openCounter, setOpenCounter] = useState(0)
  // Reseteamos el flag cuando se vuelve a abrir el modal (otro modelo, etc).
  useEffect(() => {
    if (open) {
      setSubmitted(null)
      setOtpStep('idle')
      setOtpCode('')
      setOtpError(null)
      handledSuccessRef.current = false
      setOpenCounter((c) => c + 1)
    }
  }, [open])

  // OTP soft (post-success). El lead ya se persistió y el mail a la marca
  // ya se despachó en `submitLead`. Este paso verifica el email para setear
  // la cookie `cf_client` (proof alto) — el visitante entra al catálogo
  // como identificado en su próxima interacción, sin ver el gate. Si ya
  // tiene `cf_client` (verificó OTP en otra sesión / con Ximia) saltamos
  // el prompt directamente al mensaje final.
  const clientStatus = useClientIdentified()
  const alreadyVerified = clientStatus.source === 'verified'
  const [otpStep, setOtpStep] = useState<'idle' | 'requesting' | 'input' | 'verifying' | 'done'>(
    'idle',
  )
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  // Cuando el LeadForm nos avisa onSuccess, arrancamos el OTP (a menos que
  // el visitante ya esté verificado por una interacción previa).
  const handleLeadSuccess = async (details?: {
    email: string
    name: string | null
  }) => {
    if (handledSuccessRef.current) return
    handledSuccessRef.current = true
    setSubmitted(details ?? { email: '', name: null })
    if (!details?.email) return
    if (alreadyVerified) {
      setOtpStep('done')
      return
    }
    setOtpStep('requesting')
    setOtpError(null)
    const res = await requestOTP({
      email: details.email,
      name: details.name || details.email,
    })
    if (res.ok) {
      setOtpStep('input')
    } else {
      // Si falla el envío del código, seguimos igual — el lead se persistió,
      // el mail a la marca salió, no queremos bloquear al usuario. Solo
      // mostramos el mensaje de éxito sin la parte del OTP.
      setOtpStep('done')
      setOtpError(res.error)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitted?.email) return
    if (otpCode.length !== 4) return
    setOtpStep('verifying')
    setOtpError(null)
    const res = await verifyOTP({ email: submitted.email, code: otpCode })
    if (res.ok) {
      setOtpStep('done')
    } else {
      setOtpError(res.error)
      setOtpStep('input')
    }
  }

  const resolvedEyebrow = submitted
    ? 'Gracias por contactarnos'
    : (eyebrow ?? (hasContext ? 'Quiero esta casa' : 'Contactanos'))
  const resolvedTitle = submitted
    ? null
    : (title ?? 'Dejanos tus datos y te contactamos')
  const resolvedSubmitLabel =
    submitLabel ?? (hasContext ? 'Quiero esta casa →' : 'Contactanos →')

  const showOtpCard =
    submitted && (otpStep === 'requesting' || otpStep === 'input' || otpStep === 'verifying')

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
        {showOtpCard && (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>
              Verificá tu email para que nadie más use tus datos.
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#666' }}>
              {otpStep === 'requesting'
                ? 'Te estamos enviando un código de 4 dígitos…'
                : (
                  <>
                    Te enviamos un código a <strong>{submitted?.email}</strong>. Puede tardar
                    un minuto.
                  </>
                )}
            </p>
            {(otpStep === 'input' || otpStep === 'verifying') && (
              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="Código"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={otpStep === 'verifying'}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #E2E0D8',
                    borderRadius: 8,
                    fontSize: 14,
                    letterSpacing: '0.2em',
                    textAlign: 'center',
                  }}
                />
                <button
                  type="submit"
                  disabled={otpCode.length !== 4 || otpStep === 'verifying'}
                  style={{
                    padding: '10px 18px',
                    background: '#ff003d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: otpCode.length === 4 ? 'pointer' : 'not-allowed',
                    opacity: otpCode.length === 4 && otpStep !== 'verifying' ? 1 : 0.6,
                  }}
                >
                  {otpStep === 'verifying' ? 'Verificando…' : 'Verificar'}
                </button>
              </form>
            )}
            {otpError && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#c00000' }}>{otpError}</p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#999' }}>
              Podés cerrar sin verificar — tu consulta ya llegó. Verificar te ahorra
              tener que dejar tus datos de nuevo.
            </p>
          </div>
        )}
        {submitted && otpStep === 'done' && !alreadyVerified && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>
              ✓ Email verificado — la próxima vez entrás sin registrarte.
            </p>
          </div>
        )}
        {/* key={message}: el textarea de LeadForm usa defaultValue (no
            controlado), que se lee una sola vez al montar. LeadForm se monta
            con ReservarModal — antes de que el usuario elija variante/tramo.
            Cambiar el key lo remonta con el mensaje prefilled actualizado.
            Se mantiene montado incluso después de submitted para que su
            propio success state (con botón WhatsApp) siga visible bajo la
            card de OTP. */}
        <LeadForm
          key={`${message}-${openCounter}`}
          defaultLocalidad={null}
          defaultMessage={message}
          variant="light"
          submitLabel={resolvedSubmitLabel}
          catalog={contextToCatalog(context)}
          onSuccess={handleLeadSuccess}
        />
      </div>
    </dialog>
  )
}
