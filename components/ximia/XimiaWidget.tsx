'use client'

/**
 * Widget propio de Ximia — reemplazo de Botpress.
 *
 * Contrato con n8n (ver docs/XIMIA_WIDGET_MIGRATION.md):
 *   POST construirfacil.app.n8n.cloud/webhook/ximia-v2-lab/chat
 *   body: { chatInput, sessionId, user_id, email, name, phone }   ← PLANO
 *   first turn (al abrir): chatInput = "__START__" → n8n abre con saludo.
 *   response: { reply }   ← lo que renderizamos.
 *
 * Identidad: la consigue `/api/ximia/identity` que combina cookie cf_client
 * + sesión Supabase. n8n hace el JOIN a public.users con `user_id || email`
 * → enriquece name/phone solo.
 *
 * Globalmente montado en `app/layout.tsx`. Se auto-oculta en `/admin/*`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { requestOTP, verifyOTP } from '@/app/(auth)/gate/actions'
import styles from './XimiaWidget.module.css'

const WEBHOOK_URL =
  process.env.NEXT_PUBLIC_XIMIA_WEBHOOK_URL ??
  'https://construirfacil.app.n8n.cloud/webhook/ximia-v2-lab/chat'

const STORAGE_KEY = 'cf_ximia_session_id'

type Identity = { user_id: string | null; email: string | null }
type Msg = { role: 'user' | 'assistant'; text: string }
type AuthStep = 'idle' | 'request' | 'verify'

// Render inline mínimo: **bold** y *italic*. Ximia los usa para resaltar
// modelos/precios. `white-space: pre-wrap` en la burbuja ya cubre los \n.
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // image ![alt](url)  |  bold **x**  |  italic *x*  (image first so it isn't eaten by *)
  const re = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2] !== undefined) {
      // m[1] = alt, m[2] = url — render the desire photo inline
      parts.push(
        <img
          key={i++}
          src={m[2]}
          alt={m[1]}
          loading="lazy"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '320px',
            height: 'auto',
            borderRadius: '12px',
            margin: '10px 0',
          }}
        />,
      )
    } else if (m[3] !== undefined) parts.push(<strong key={i++}>{m[3]}</strong>)
    else if (m[4] !== undefined) parts.push(<em key={i++}>{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function XimiaWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [identity, setIdentity] = useState<Identity>({ user_id: null, email: null })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [authStep, setAuthStep] = useState<AuthStep>('idle')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const startedRef = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const authEmailRef = useRef<HTMLInputElement>(null)
  const authCodeRef = useRef<HTMLInputElement>(null)

  // sessionId persistente — sobrevive reloads, una por navegador.
  useEffect(() => {
    try {
      let sid = localStorage.getItem(STORAGE_KEY)
      if (!sid) {
        sid = crypto.randomUUID()
        localStorage.setItem(STORAGE_KEY, sid)
      }
      setSessionId(sid)
    } catch {
      // localStorage puede fallar en private browsing — generamos sessionId in-memory.
      setSessionId(crypto.randomUUID())
    }
  }, [])

  // Identidad — server-side combina cf_client + Supabase auth. Devolvemos la identidad
  // resuelta para poder reusarla in-flight tras un verifyOTP (sin esperar al re-render).
  const loadIdentity = useCallback(async (): Promise<Identity> => {
    try {
      const r = await fetch('/api/ximia/identity', { cache: 'no-store' })
      const data = await r.json()
      const next: Identity = { user_id: data?.user_id ?? null, email: data?.email ?? null }
      setIdentity(next)
      return next
    } catch {
      return identity
    }
    // identity solo se usa como fallback si el fetch falla → no es dependencia real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadIdentity()
  }, [loadIdentity])

  // Autoscroll al fondo cuando llega un mensaje o aparece typing.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  // Foco al input cuando se abre, y cada vez que Ximia termina de responder
  // (el input se rehabilita pero el browser no devuelve el foco solo). Cuando
  // el card de auth está abierto, el foco va al campo activo del card.
  useEffect(() => {
    if (!open) return
    if (authStep === 'request') authEmailRef.current?.focus()
    else if (authStep === 'verify') authCodeRef.current?.focus()
    else if (!typing) inputRef.current?.focus()
  }, [open, typing, authStep])

  // ESC para cerrar.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = useCallback(
    async (text: string, opts?: { isStart?: boolean; identityOverride?: Identity }) => {
      if (!sessionId) return
      const isStart = opts?.isStart === true
      let id = opts?.identityOverride ?? identity
      // Lab mode: en /ximia-lab el equipo prueba múltiples casos sin verificar mail
      // cada vez. Si no hay identidad real, pasamos un email único por sessionId →
      // el Compliance lint del agente lo trata como verified y nunca pide OTP.
      // "Empezar de nuevo" en la page limpia el sessionId → nuevo email fake.
      const isLab = pathname?.startsWith('/ximia-lab') ?? false
      if (isLab && !id.user_id && !id.email) {
        id = {
          user_id: null,
          email: `test+${sessionId.slice(0, 8)}@construirfacil.com`,
        }
      }
      setTyping(true)
      const t0 = performance.now()
      try {
        const body = {
          chatInput: text,
          sessionId,
          user_id: id.user_id,
          email: id.email,
          name: null,
          phone: null,
        }
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        const reply: string = data?.reply ?? data?.output ?? ''
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.info(
            `[Ximia] ${isStart ? '__START__' : 'turn'} ${Math.round(performance.now() - t0)}ms\n` +
              JSON.stringify(data, null, 2),
          )
        }
        if (reply) {
          setMessages((m) => [...m, { role: 'assistant', text: reply }])
        } else if (isStart) {
          // n8n no devolvió saludo — fallback discreto para que el chat no quede en blanco.
          setMessages((m) => [...m, { role: 'assistant', text: '¡Hola! Soy Ximia. Contame qué casa estás buscando.' }])
        }
        // Auth gate (#32): si Ximia decidió que es momento de verificar y todavía
        // no tenemos identidad, levantamos el card inline. El user nunca tipea email/código
        // dentro del chat → el agente no se desincroniza.
        if (data?.requires_auth === true && !id.user_id && !id.email) {
          setAuthError(null)
          setAuthStep('request')
        }
      } catch (err) {
        console.error('[Ximia] send error', err)
        setMessages((m) => [...m, { role: 'assistant', text: 'Tuve un problema para responder. Probá de nuevo en un momento.' }])
      } finally {
        setTyping(false)
      }
    },
    [sessionId, identity, pathname],
  )

  // __START__ la primera vez que se abre el chat en esta sesión (no en cada reload).
  useEffect(() => {
    if (!open || startedRef.current || !sessionId || messages.length > 0) return
    startedRef.current = true
    void send('__START__', { isStart: true })
  }, [open, sessionId, messages.length, send])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || typing) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    void send(text)
  }

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = authName.trim()
    const email = authEmail.trim()
    if (!name || !email || authBusy) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const res = await requestOTP({ email, name })
      if (res.ok) {
        setAuthStep('verify')
      } else {
        setAuthError(res.error)
      }
    } catch {
      setAuthError('No pudimos mandarte el código. Probá de nuevo.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = authCode.trim()
    const email = authEmail.trim()
    if (!email || code.length !== 4 || authBusy) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const res = await verifyOTP({ email, code })
      if (!res.ok) {
        setAuthError(res.error)
        return
      }
      // Cookie cf_client ya seteada. Refresh identidad para los próximos turnos.
      const next = await loadIdentity()
      const resumeText = 'Listo, verifiqué mi email.'
      setMessages((m) => [...m, { role: 'user', text: resumeText }])
      setAuthStep('idle')
      setAuthCode('')
      // Mandamos el mensaje con la identidad recién resuelta — sin esperar el re-render.
      void send(resumeText, { identityOverride: next })
    } catch {
      setAuthError('No pudimos verificar el código. Probá de nuevo.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleResendOTP = async () => {
    if (authBusy || !authEmail.trim() || !authName.trim()) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const res = await requestOTP({ email: authEmail.trim(), name: authName.trim() })
      if (!res.ok) setAuthError(res.error)
    } finally {
      setAuthBusy(false)
    }
  }

  // Por ahora el widget solo se monta en las páginas de prueba (/ximia-lab*
  // sin gate y /ximia-demo* con OTP). NO se muestra en el catálogo público
  // hasta que decidamos el rollout. (Para volver a habilitar global, invertir
  // la condición y skip solo en /admin/*.)
  const allow = pathname?.startsWith('/ximia-lab') || pathname?.startsWith('/ximia-demo')
  if (!allow) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.fab}
          aria-label="Hablar con Ximia"
          onClick={() => setOpen(true)}
        >
          <img src="/AI-Icon.gif" alt="" className={styles.fabImg} />
        </button>
      )}

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Ximia chat" className={styles.panel}>
            <header className={styles.header}>
              <img src="/AI-Icon.gif" alt="" className={styles.headerAvatar} />
              <div className={styles.headerText}>
                <div className={styles.headerTitle}>Ximia</div>
                <div className={styles.headerSubtitle}>Asistente IA</div>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>

            <div className={styles.body} ref={bodyRef}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}
                >
                  {m.role === 'assistant' && <img src="/AI-Icon.gif" alt="" className={styles.msgAvatar} />}
                  <div className={styles.bubble}>{renderInline(m.text)}</div>
                </div>
              ))}
              {(typing || (open && messages.length === 0)) && (
                <div className={`${styles.msg} ${styles.msgBot}`}>
                  <img src="/AI-Icon.gif" alt="" className={styles.msgAvatar} />
                  <div className={`${styles.bubble} ${styles.typing}`}>
                    <span /><span /><span />
                  </div>
                </div>
              )}

              {authStep === 'request' && (
                <form className={styles.authCard} onSubmit={handleRequestOTP}>
                  <div className={styles.authTitle}>Verifiquemos tu email</div>
                  <div className={styles.authHint}>
                    Te llega un código de 4 dígitos para que sigamos con los números reales.
                  </div>
                  <input
                    ref={authEmailRef}
                    type="text"
                    className={styles.authInput}
                    placeholder="Tu nombre"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    disabled={authBusy}
                    autoComplete="given-name"
                  />
                  <input
                    type="email"
                    className={styles.authInput}
                    placeholder="tu@email.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    disabled={authBusy}
                    autoComplete="email"
                    inputMode="email"
                    pattern="[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}"
                    title="Ingresá un email válido (ej: nombre@dominio.com)"
                  />
                  {authError && <div className={styles.authError}>{authError}</div>}
                  <button
                    type="submit"
                    className={styles.authSubmit}
                    disabled={authBusy || !authName.trim() || !authEmail.trim()}
                  >
                    {authBusy ? 'Mandando…' : 'Mandame el código'}
                  </button>
                </form>
              )}

              {authStep === 'verify' && (
                <form className={styles.authCard} onSubmit={handleVerifyOTP}>
                  <div className={styles.authTitle}>Código enviado</div>
                  <div className={styles.authHint}>
                    Te llegó un correo a <strong>{authEmail}</strong>. Puede tardar un minuto.
                  </div>
                  <input
                    ref={authCodeRef}
                    type="text"
                    className={styles.authInput}
                    placeholder="Código de 4 dígitos"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    disabled={authBusy}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                  />
                  {authError && <div className={styles.authError}>{authError}</div>}
                  <div className={styles.authActions}>
                    <button
                      type="submit"
                      className={styles.authSubmit}
                      disabled={authBusy || authCode.length !== 4}
                    >
                      {authBusy ? 'Verificando…' : 'Verificar'}
                    </button>
                    <button
                      type="button"
                      className={styles.authResend}
                      onClick={handleResendOTP}
                      disabled={authBusy}
                    >
                      Reenviar código
                    </button>
                  </div>
                </form>
              )}
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder={authStep !== 'idle' ? 'Verificá tu email para seguir…' : 'Escribí tu pregunta…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={typing || authStep !== 'idle'}
                autoComplete="off"
              />
              <button
                type="submit"
                className={styles.send}
                disabled={!input.trim() || typing || authStep !== 'idle'}
              >
                Enviar
              </button>
            </form>
          </div>
        </>
      )}
    </>
  )
}
