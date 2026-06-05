'use client'

/**
 * components/auth/CatalogGate.tsx
 *
 * Modal de 2 pasos que bloquea el catálogo hasta que el visitante:
 *   1) Ingresa email + nombre → requestOTP
 *   2) Ingresa código de 4 dígitos del mail → verifyOTP
 * Una vez verificado, recarga la página (la cookie HTTP-only ya está
 * seteada y el server-side ya no muestra el gate).
 *
 * UX:
 *   - Full-screen overlay con backdrop blur (lo que está atrás se ve
 *     borroso, no oculto — refuerza que hay catálogo esperando).
 *   - Auto-focus de inputs.
 *   - Boton "Cambiar email" en step 2 vuelve a step 1.
 *   - Resend disponible cuando termina un cooldown corto.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestOTP, verifyOTP } from '@/app/(auth)/gate/actions'
import { startGoogleOAuth } from '@/app/(auth)/gate/google-action'
import { startFacebookOAuth } from '@/app/(auth)/gate/facebook-action'

type Step = 'email' | 'code'

const RESEND_COOLDOWN_S = 30

export default function CatalogGate() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [resendCountdown, setResendCountdown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
    else emailRef.current?.focus()
  }, [step])

  // Cooldown del resend.
  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setTimeout(() => setResendCountdown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCountdown])

  function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await requestOTP({ email, name })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setStep('code')
      setResendCountdown(RESEND_COOLDOWN_S)
    })
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await verifyOTP({ email, code })
      if (!res.ok) {
        setError(res.error)
        setCode('')
        codeRef.current?.focus()
        return
      }
      // Cookie ya seteada — forzar refresh del server tree.
      router.refresh()
    })
  }

  function handleResend() {
    setError(null)
    setCode('')
    setResendCountdown(RESEND_COOLDOWN_S)
    startTransition(async () => {
      const res = await requestOTP({ email, name })
      if (!res.ok) setError(res.error)
    })
  }

  function handleGoogle() {
    setError(null)
    startTransition(async () => {
      const res = await startGoogleOAuth()
      if (!res.ok) {
        setError(res.error)
        return
      }
      window.location.assign(res.url)
    })
  }

  function handleFacebook() {
    setError(null)
    startTransition(async () => {
      const res = await startFacebookOAuth()
      if (!res.ok) {
        setError(res.error)
        return
      }
      window.location.assign(res.url)
    })
  }

  return (
    <div className="cf-gate-root" aria-modal="true" role="dialog">
      <div className="cf-gate-backdrop" />
      <div className="cf-gate-card">
        <div className="cf-gate-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cf_logo_gris.png" alt="ConstruirFácil" />
        </div>

        {step === 'email' ? (
          <>
            <h2 className="cf-gate-title">El catálogo te espera.</h2>
            <p className="cf-gate-body">
              Decinos quién sos para acceder. Podés ingresar con Google o con
              tu email.
            </p>
            <div className="cf-gate-oauth-row">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={pending}
                className="cf-gate-google"
              >
                <GoogleG />
                Continuar con Google
              </button>
              <button
                type="button"
                onClick={handleFacebook}
                disabled={pending}
                className="cf-gate-facebook"
              >
                <FacebookF />
                Continuar con Facebook
              </button>
            </div>
            <div className="cf-gate-divider">
              <span>o usá tu email</span>
            </div>
            <form onSubmit={handleRequest} className="cf-gate-form">
              <label className="cf-gate-field">
                <span>Nombre</span>
                <input
                  ref={emailRef}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  disabled={pending}
                />
              </label>
              <label className="cf-gate-field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={pending}
                />
              </label>
              {error && <p className="cf-gate-error">{error}</p>}
              <button type="submit" className="cf-gate-cta" disabled={pending}>
                {pending ? 'Enviando…' : 'Recibir código'}
              </button>
            </form>
            <p className="cf-gate-fineprint">
              Tu email queda registrado solo si verificás el código. No
              compartimos tus datos con terceros.
            </p>
          </>
        ) : (
          <>
            <h2 className="cf-gate-title">Ingresá el código</h2>
            <p className="cf-gate-body">
              Te enviamos un código de 4 dígitos a{' '}
              <strong>{email}</strong>. Revisá la bandeja de entrada y SPAM.
            </p>
            <form onSubmit={handleVerify} className="cf-gate-form">
              <label className="cf-gate-field">
                <span>Código</span>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="cf-gate-code-input"
                  disabled={pending}
                  autoComplete="one-time-code"
                />
              </label>
              {error && <p className="cf-gate-error">{error}</p>}
              <button
                type="submit"
                className="cf-gate-cta"
                disabled={pending || code.length !== 4}
              >
                {pending ? 'Verificando…' : 'Entrar al catálogo'}
              </button>
            </form>
            <div className="cf-gate-secondary">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
                className="cf-gate-link"
              >
                Cambiar email
              </button>
              <button
                type="button"
                onClick={handleResend}
                className="cf-gate-link"
                disabled={resendCountdown > 0 || pending}
              >
                {resendCountdown > 0
                  ? `Reenviar (${resendCountdown}s)`
                  : 'Reenviar código'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FacebookF() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#fff"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.018 1.792-4.685 4.533-4.685 1.313 0 2.686.235 2.686.235v2.965h-1.514c-1.491 0-1.956.93-1.956 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  )
}

function GoogleG() {
  // Logo G de Google (multicolor oficial). SVG inline para evitar request extra.
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.614z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.708V4.96H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.164 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
