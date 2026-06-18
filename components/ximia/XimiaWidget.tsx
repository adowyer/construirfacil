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
import styles from './XimiaWidget.module.css'

const WEBHOOK_URL =
  process.env.NEXT_PUBLIC_XIMIA_WEBHOOK_URL ??
  'https://construirfacil.app.n8n.cloud/webhook/ximia-v2-lab/chat'

const STORAGE_KEY = 'cf_ximia_session_id'

type Identity = { user_id: string | null; email: string | null }
type Msg = { role: 'user' | 'assistant'; text: string }

export default function XimiaWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [identity, setIdentity] = useState<Identity>({ user_id: null, email: null })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const startedRef = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Identidad — fetch al endpoint server-side que combina cf_client + Supabase auth.
  useEffect(() => {
    fetch('/api/ximia/identity')
      .then((r) => r.json())
      .then((data) => setIdentity({ user_id: data?.user_id ?? null, email: data?.email ?? null }))
      .catch(() => {})
  }, [])

  // Autoscroll al fondo cuando llega un mensaje o aparece typing.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  // Foco al input cuando se abre, y cada vez que Ximia termina de responder
  // (el input se rehabilita pero el browser no devuelve el foco solo).
  useEffect(() => {
    if (open && !typing) inputRef.current?.focus()
  }, [open, typing])

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
    async (text: string, isStart = false) => {
      if (!sessionId) return
      setTyping(true)
      const t0 = performance.now()
      try {
        const body = {
          chatInput: text,
          sessionId,
          user_id: identity.user_id,
          email: identity.email,
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
      } catch (err) {
        console.error('[Ximia] send error', err)
        setMessages((m) => [...m, { role: 'assistant', text: 'Tuve un problema para responder. Probá de nuevo en un momento.' }])
      } finally {
        setTyping(false)
      }
    },
    [sessionId, identity],
  )

  // __START__ la primera vez que se abre el chat en esta sesión (no en cada reload).
  useEffect(() => {
    if (!open || startedRef.current || !sessionId || messages.length > 0) return
    startedRef.current = true
    void send('__START__', true)
  }, [open, sessionId, messages.length, send])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || typing) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    void send(text)
  }

  // El widget no se monta en admin.
  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.fab}
          aria-label="Hablar con Ximia"
          onClick={() => setOpen(true)}
        />
      )}

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Ximia chat" className={styles.panel}>
            <header className={styles.header}>
              <div className={styles.headerAvatar} aria-hidden="true" />
              <div className={styles.headerText}>
                <div className={styles.headerTitle}>Ximia</div>
                <div className={styles.headerSubtitle}>Tu asistente para encontrar casa</div>
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
                  {m.role === 'assistant' && <div className={styles.msgAvatar} aria-hidden="true" />}
                  <div className={styles.bubble}>{m.text}</div>
                </div>
              ))}
              {(typing || (open && messages.length === 0)) && (
                <div className={`${styles.msg} ${styles.msgBot}`}>
                  <div className={styles.msgAvatar} aria-hidden="true" />
                  <div className={`${styles.bubble} ${styles.typing}`}>
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder="Escribí tu pregunta…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={typing}
                autoComplete="off"
              />
              <button
                type="submit"
                className={styles.send}
                disabled={!input.trim() || typing}
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
