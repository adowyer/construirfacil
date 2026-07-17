'use client'

/**
 * components/LeadForm.tsx
 *
 * Form de conversión real (/cotizar). Al enviarse escribe un lead a
 * Supabase (server action, atribución por cookies) y dispara track('lead')
 * para que el evento entre también al ledger. WhatsApp = camino secundario,
 * sólo si hay número configurado (si no, no se muestra: nada de CTA muerto).
 */

import { useActionState, useEffect, useRef, useState } from 'react'
import { submitLead, type LeadResult } from '@/app/cotizar/actions'
import { track } from '@/lib/track/client'
import { buildWhatsappUrl } from '@/lib/cta/whatsapp'
import {
  refetchClientStatus,
  useClientIdentified,
} from '@/lib/auth/use-client-identified'
import { AntiSpamFields } from '@/components/anti-spam/AntiSpamFields'

const FIELD = {
  dark: 'w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/20 transition-colors',
  light:
    'w-full bg-white border border-[#E2E0D8] rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder:text-neutral-400 focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/15 transition-colors',
}
const LBL = {
  dark: 'block text-[11px] uppercase tracking-widest text-white/45 mb-1.5',
  light: 'block text-[11px] uppercase tracking-widest text-neutral-400 mb-1.5',
}

export interface LeadFormCatalogContext {
  /** Marca (FK marcas) — para que el lead llegue al email correcto y la
   *  pantalla post-success ofrezca WA con el número per-marca. */
  marca_id?: string | null
  marca_name?: string | null
  /** Número de WhatsApp de la marca (sin "+" ni espacios). Si no se pasa,
   *  cae al fallback `NEXT_PUBLIC_WHATSAPP_NUMBER`. */
  marca_whatsapp?: string | null
  model_slug?: string | null
  style_name?: string | null
  tipologia_code_new?: string | null
  variante?: string | null
  sistema_constructivo?: string | null
  provincia_id?: string | null
  /** Contexto de lote del usuario (filtro Lote en StickyFilters). 'si'
   *  (tiene lote), 'no' (busca casa+lote), null (no eligió). */
  tiene_lote?: 'si' | 'no' | null
  precio_desde_usd?: number | null
  cuota_ars?: number | null
}

export function LeadForm({
  defaultLocalidad,
  defaultMessage,
  variant = 'dark',
  submitLabel = 'Quiero que me contacten',
  catalog,
  onSuccess,
}: {
  defaultLocalidad?: string | null
  /** Prefilla el campo "Contanos qué buscás" — útil cuando el form se abre
   *  desde una selección concreta del catálogo (modelo, variante, SC, plan)
   *  para que el usuario no escriba todo de nuevo. */
  defaultMessage?: string | null
  variant?: 'dark' | 'light'
  /** Copy del botón submit. Default genérico para /cotizar; el catálogo
   *  (ReservarModal) usa "Quiero esta casa →" porque ya hay un modelo
   *  concreto y suena a cierre, no a "dejá tus datos". */
  submitLabel?: string
  /** Contexto del catálogo cuando el form se abre desde "Quiero esta casa"
   *  — se materializa en hidden inputs para que el server action lo
   *  persista en `leads` y lo use para el email a la marca. */
  catalog?: LeadFormCatalogContext
  /** Se llama una vez cuando el lead se envió OK. Permite al padre
   *  (ej. ReservarModal) reaccionar — cambiar headers, cerrar modal, etc.
   *  Recibe `email` + `name` del lead recién persistido cuando vienen del
   *  server action (state.ok reciente). Cuando `onSuccess` dispara por
   *  cf_session previa (visita reincidente), sólo llega `email` desde la
   *  cookie firmada — no tenemos el nombre en ese path. */
  onSuccess?: (details?: { email: string; name: string | null }) => void
}) {
  const field = FIELD[variant]
  const lbl = LBL[variant]
  const isLight = variant === 'light'
  const [state, formAction, isPending] = useActionState<LeadResult, FormData>(
    submitLead,
    { ok: false, error: null },
  )
  const pathRef = useRef<HTMLInputElement>(null)
  const [waUrl, setWaUrl] = useState<string | null>(null)
  // Si el visitante ya envió un lead antes (cookie cf_session), arrancamos
  // directamente en success state — no le pedimos los datos otra vez.
  const clientStatus = useClientIdentified()
  const existingLeadEmail = clientStatus.leadEmail

  useEffect(() => {
    if (pathRef.current) pathRef.current.value = window.location.pathname
    setWaUrl(
      buildWhatsappUrl({
        localidad: defaultLocalidad ?? null,
        modelName: catalog?.style_name ?? null,
        marcaWhatsapp: catalog?.marca_whatsapp ?? null,
      }),
    )
  }, [defaultLocalidad, catalog?.style_name, catalog?.marca_whatsapp])

  useEffect(() => {
    if (state.ok) {
      track('lead')
      // El submitLead seteó la cookie cf_session — re-cacheamos el status
      // para que otros componentes (slides gated, CTAs) vean al usuario
      // como identificado sin recargar la página.
      refetchClientStatus().catch(() => {})
      onSuccess?.(
        state.email
          ? { email: state.email, name: state.name ?? null }
          : undefined,
      )
    }
  }, [state.ok, state.email, state.name, onSuccess])

  // Avisa al padre cuando descubrimos que el visitante ya tenía session
  // de lead, para que el modal (ReservarModal) ajuste su header.
  useEffect(() => {
    if (existingLeadEmail) {
      onSuccess?.({ email: existingLeadEmail, name: null })
    }
  }, [existingLeadEmail, onSuccess])

  if (state.ok || existingLeadEmail) {
    // Distinción de copy según contexto:
    //   - state.ok           → lead enviado RECIÉN (en este request)
    //   - existingLeadEmail  → lead enviado ANTES (cookie cf_session previa)
    const wasJustSubmitted = state.ok
    return (
      <div className="text-center py-10">
        <p
          className={`text-2xl font-black uppercase tracking-tight ${
            isLight ? 'text-[#1a1a1a]' : 'text-white'
          }`}
        >
          {wasJustSubmitted ? 'Llegó tu consulta' : 'Ya tenemos tus datos'}
        </p>
        <p
          className={`mt-3 max-w-sm mx-auto ${
            isLight ? 'text-neutral-500' : 'text-white/60'
          }`}
        >
          {wasJustSubmitted
            ? 'En las próximas horas un asesor te escribe para avanzar con tu casa. Si querés agilizar, podemos seguir directo por acá:'
            : 'Un asesor te va a contactar a la brevedad. Si querés agilizar, podemos seguir directo por acá:'}
        </p>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click')}
            className="inline-flex items-center gap-2 mt-6 bg-[#25D366] text-black px-7 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <WhatsappLogo />
            Continuar por WhatsApp
          </a>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="path" ref={pathRef} />
      {/* Anti-spam: honeypot + Turnstile (env-gated). Ver
          `components/anti-spam/AntiSpamFields.tsx`. */}
      <AntiSpamFields errorSignal={state.error} theme={isLight ? 'light' : 'dark'} />
      {/* Contexto del catálogo — hidden inputs que el action lee + persiste
          en columnas de `leads`. Solo se renderizan los valores presentes;
          el form genérico /cotizar (sin catalog) los omite todos. */}
      {catalog?.marca_id && (
        <input type="hidden" name="marca_id" value={catalog.marca_id} />
      )}
      {catalog?.model_slug && (
        <input type="hidden" name="model_slug" value={catalog.model_slug} />
      )}
      {catalog?.style_name && (
        <input type="hidden" name="style_name" value={catalog.style_name} />
      )}
      {catalog?.tipologia_code_new && (
        <input
          type="hidden"
          name="tipologia_code_new"
          value={catalog.tipologia_code_new}
        />
      )}
      {catalog?.variante && (
        <input type="hidden" name="variante" value={catalog.variante} />
      )}
      {catalog?.sistema_constructivo && (
        <input
          type="hidden"
          name="sistema_constructivo"
          value={catalog.sistema_constructivo}
        />
      )}
      {catalog?.provincia_id && (
        <input type="hidden" name="provincia_id" value={catalog.provincia_id} />
      )}
      {/* tiene_lote NO va como hidden — el form ya pregunta por terreno
          explícitamente abajo. El context del filtro Casa+Lote se usa solo
          como `defaultChecked` del radio (ver `defaultTieneLote` abajo). */}
      {catalog?.precio_desde_usd != null && (
        <input
          type="hidden"
          name="precio_desde_usd"
          value={String(catalog.precio_desde_usd)}
        />
      )}
      {catalog?.cuota_ars != null && (
        <input type="hidden" name="cuota_ars" value={String(catalog.cuota_ars)} />
      )}

      {state.error && (
        <div
          role="alert"
          className={`text-sm px-4 py-3 rounded-lg border ${
            isLight
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={lbl} htmlFor="lf-name">
            Nombre
          </label>
          <input
            id="lf-name"
            name="name"
            required
            autoComplete="given-name"
            className={field}
            placeholder="Tu nombre"
          />
        </div>
        <div>
          <label className={lbl} htmlFor="lf-apellido">
            Apellido
          </label>
          <input
            id="lf-apellido"
            name="apellido"
            required
            autoComplete="family-name"
            className={field}
            placeholder="Tu apellido"
          />
        </div>
        <div>
          <label className={lbl} htmlFor="lf-phone">
            Teléfono
          </label>
          <input
            id="lf-phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            className={field}
            placeholder="Cód. área + número"
          />
        </div>
        <div>
          <label className={lbl} htmlFor="lf-email">
            Email
          </label>
          <input
            id="lf-email"
            name="email"
            type="email"
            required
            pattern="[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}"
            title="Ingresá un email válido (ej: nombre@dominio.com)"
            autoComplete="email"
            className={field}
            placeholder="tu@email.com"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl} htmlFor="lf-localidad">
            Localidad
          </label>
          <input
            id="lf-localidad"
            name="localidad"
            required
            defaultValue={defaultLocalidad ?? ''}
            className={field}
            placeholder="Ej: Rincón de los Sauces"
          />
        </div>
      </div>

      {/* Calificación — preguntas que ventas usa para priorizar el lead.
          Visualmente diferenciadas (radios horizontales / select) y agrupadas
          bajo un eyebrow para que no se sientan parte del contacto. */}
      <div className="space-y-5">
        <p className={`text-[11px] uppercase tracking-widest ${isLight ? 'text-neutral-400' : 'text-white/40'}`}>
          Para asesorarte mejor
        </p>

        <fieldset>
          <legend className={lbl}>¿Tenés terreno?</legend>
          <RadioRow
            name="tiene_lote"
            options={[
              { value: 'si', label: 'Sí' },
              { value: 'no', label: 'No' },
            ]}
            defaultValue={catalog?.tiene_lote ?? null}
            variant={variant}
            required
          />
        </fieldset>

        <fieldset>
          <legend className={lbl}>¿Cuándo te gustaría tener tu casa?</legend>
          <RadioRow
            name="timeframe"
            options={[
              { value: '3m', label: '3 meses' },
              { value: '6m', label: '6 meses' },
              { value: '1y', label: '1 año' },
            ]}
            variant={variant}
            required
          />
        </fieldset>

        <div>
          <label className={lbl} htmlFor="lf-ahorro">
            ¿Tenés algún ahorro para aportar?{' '}
            <span className={`normal-case ${isLight ? 'text-neutral-400' : 'text-white/25'}`}>(opcional)</span>
          </label>
          <select
            id="lf-ahorro"
            name="ahorro_ars_range"
            defaultValue=""
            className={field}
          >
            <option value="">Elegí una opción…</option>
            <option value="none">Aún no</option>
            <option value="lt_10m">Menos de $10 millones</option>
            <option value="10m_30m">Entre $10 y $30 millones</option>
            <option value="30m_60m">Entre $30 y $60 millones</option>
            <option value="60m_plus">Más de $60 millones</option>
          </select>
        </div>
      </div>

      <div>
        <label className={lbl} htmlFor="lf-message">
          Contanos qué buscás{' '}
          <span className={`normal-case ${isLight ? 'text-neutral-400' : 'text-white/25'}`}>(opcional)</span>
        </label>
        <textarea
          id="lf-message"
          name="message"
          rows={3}
          defaultValue={defaultMessage ?? ''}
          className={`${field} resize-none`}
          placeholder="Modelo que te gustó, cantidad de dormitorios, cuándo querés construir…"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#ff003d] text-white px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : submitLabel}
      </button>

      <p className={`text-xs text-center ${isLight ? "text-neutral-400" : "text-white/35"}`}>
        Sin compromiso. Te contactamos para asesorarte y darte tu cotización.
      </p>
    </form>
  )
}

/**
 * Grupo de radios horizontal (tipo "pill switch"). Uncontrolled — el form
 * envía el valor seleccionado bajo el name compartido. `defaultValue` se
 * convierte en `defaultChecked` en la opción que matchea.
 */
function RadioRow({
  name,
  options,
  defaultValue,
  variant,
  required,
}: {
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string | null
  variant: 'dark' | 'light'
  required?: boolean
}) {
  const isLight = variant === 'light'
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-2 mt-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium cursor-pointer transition-colors
            ${
              isLight
                ? 'bg-white border-[#E2E0D8] text-[#1a1a1a] hover:border-[#ff003d]/40 has-[:checked]:bg-[#ff003d] has-[:checked]:text-white has-[:checked]:border-[#ff003d]'
                : 'bg-white/5 border-white/15 text-white hover:border-white/30 has-[:checked]:bg-[#ff003d] has-[:checked]:text-white has-[:checked]:border-[#ff003d]'
            }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            required={required}
            defaultChecked={o.value === defaultValue}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function WhatsappLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  )
}
