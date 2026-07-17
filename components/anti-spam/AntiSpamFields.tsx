'use client'

/**
 * components/anti-spam/AntiSpamFields.tsx
 *
 * Bundle de anti-spam para forms públicos que llaman `submitLead`:
 *
 *  1. Honeypot invisible `hp_website` — bots completan cualquier input
 *     con `name`; el usuario real jamás lo ve. Server-side devuelve éxito
 *     fake si viene con valor (sin feedback al bot).
 *  2. Cloudflare Turnstile — widget invisible (`interaction-only`) que
 *     produce un token verificado por `lib/anti-spam/turnstile.ts`.
 *
 * Env-gated: si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no está seteada, el widget
 * no se monta y el server también skipea la verificación → no-op hasta que
 * se cargan las keys (`TURNSTILE_SECRET_KEY` en el server).
 *
 * Usage: embeber DENTRO del `<form>` que apunta a `submitLead`. Debe ser
 * hijo directo del form para que Turnstile pueda inyectar el hidden input
 * `cf-turnstile-response` que el FormData recoge automáticamente.
 *
 * ```tsx
 * <form action={formAction}>
 *   <AntiSpamFields errorSignal={state.error} theme="light" />
 *   ... resto del form ...
 * </form>
 * ```
 */

import { useEffect, useRef } from 'react'

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

declare global {
  interface Window {
    turnstile?: {
      reset: (widget?: string | HTMLElement) => void
    }
  }
}

interface Props {
  /** Señal reactiva que cambia cuando el server rechaza el submit — sirve
   *  para resetear el widget de Turnstile y generar un token fresco. Los
   *  tokens de Turnstile son single-use; sin reset, el 2do intento siempre
   *  fallaría en Cloudflare. Pasar `state.error` de useActionState. */
  errorSignal?: string | null
  /** Tema del widget cuando aparece la challenge. Los forms del catálogo
   *  usan light (modal blanco); los de /cotizar usan dark. */
  theme?: 'light' | 'dark' | 'auto'
}

export function AntiSpamFields({ errorSignal, theme = 'auto' }: Props) {
  const turnstileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    if (document.querySelector('script[data-cf-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.defer = true
    s.dataset.cfTurnstile = '1'
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!errorSignal) return
    if (!TURNSTILE_SITE_KEY) return
    const el = turnstileRef.current
    if (el && window.turnstile) {
      try {
        window.turnstile.reset(el)
      } catch {
        /* widget aún no listo — el próximo submit pedirá token fresco */
      }
    }
  }, [errorSignal])

  return (
    <>
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {TURNSTILE_SITE_KEY && (
        // Widget visible (badge chico abajo del form). Antes usábamos
        // `interaction-only` que en principio auto-emite token si no hay
        // challenge — pero en la práctica, si CF quería una challenge y el
        // usuario submiteaba rápido, el token no llegaba y devolvíamos error
        // "Falló la verificación anti-spam" ANTES de que el usuario supiera
        // que había algo que hacer. Con `always` el widget es visible desde
        // el mount y siempre hay token listo antes del submit.
        <div
          ref={turnstileRef}
          className="cf-turnstile"
          data-sitekey={TURNSTILE_SITE_KEY}
          data-theme={theme}
          data-size="flexible"
        />
      )}
    </>
  )
}
