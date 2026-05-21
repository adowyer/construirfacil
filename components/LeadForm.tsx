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

const FIELD = {
  dark: 'w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/20 transition-colors',
  light:
    'w-full bg-white border border-[#E2E0D8] rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder:text-neutral-400 focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/15 transition-colors',
}
const LBL = {
  dark: 'block text-[11px] uppercase tracking-widest text-white/45 mb-1.5',
  light: 'block text-[11px] uppercase tracking-widest text-neutral-400 mb-1.5',
}

export function LeadForm({
  defaultLocalidad,
  defaultMessage,
  variant = 'dark',
  submitLabel = 'Quiero que me contacten',
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

  useEffect(() => {
    if (pathRef.current) pathRef.current.value = window.location.pathname
    setWaUrl(buildWhatsappUrl({ localidad: defaultLocalidad ?? null }))
  }, [defaultLocalidad])

  useEffect(() => {
    if (state.ok) track('lead')
  }, [state.ok])

  if (state.ok) {
    return (
      <div className="text-center py-10">
        <p
          className={`text-2xl font-black uppercase tracking-tight ${
            isLight ? 'text-[#1a1a1a]' : 'text-white'
          }`}
        >
          ¡Recibido!
        </p>
        <p
          className={`mt-3 max-w-sm mx-auto ${
            isLight ? 'text-neutral-500' : 'text-white/60'
          }`}
        >
          Un asesor te va a contactar para avanzar con tu casa. Si querés,
          escribinos ahora mismo:
        </p>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click')}
            className="inline-block mt-6 bg-[#25D366] text-black px-7 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="path" ref={pathRef} />

      {state.error && (
        <div
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
            Nombre y apellido
          </label>
          <input
            id="lf-name"
            name="name"
            required
            autoComplete="name"
            className={field}
            placeholder="Tu nombre"
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
            Email <span className={`normal-case ${isLight ? 'text-neutral-400' : 'text-white/25'}`}>(opcional)</span>
          </label>
          <input
            id="lf-email"
            name="email"
            type="email"
            autoComplete="email"
            className={field}
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label className={lbl} htmlFor="lf-localidad">
            Localidad
          </label>
          <input
            id="lf-localidad"
            name="localidad"
            defaultValue={defaultLocalidad ?? ''}
            className={field}
            placeholder="Tu ciudad / provincia"
          />
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
