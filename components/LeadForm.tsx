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

const field =
  'w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/20 transition-colors'
const lbl = 'block text-[11px] uppercase tracking-widest text-white/45 mb-1.5'

export function LeadForm({
  defaultLocalidad,
}: {
  defaultLocalidad?: string | null
}) {
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
        <p className="text-2xl font-black uppercase tracking-tight text-white">
          ¡Recibido!
        </p>
        <p className="text-white/60 mt-3 max-w-sm mx-auto">
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
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg">
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
            Email <span className="text-white/25 normal-case">(opcional)</span>
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
          <span className="text-white/25 normal-case">(opcional)</span>
        </label>
        <textarea
          id="lf-message"
          name="message"
          rows={3}
          className={`${field} resize-none`}
          placeholder="Modelo que te gustó, cantidad de dormitorios, cuándo querés construir…"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#ff003d] text-white px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : 'Quiero que me contacten'}
      </button>

      <p className="text-xs text-white/35 text-center">
        Sin compromiso. Te contactamos para asesorarte y darte tu cotización.
      </p>
    </form>
  )
}
