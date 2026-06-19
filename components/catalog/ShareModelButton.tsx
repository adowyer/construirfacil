'use client'

/**
 * Botón "Compartir esta casa". Web Share API nativo en mobile/Safari moderno
 * (sheet del sistema con WhatsApp, mail, etc.). Desktop sin soporte: popover
 * con Copiar / WhatsApp / Email.
 *
 * La URL compartida es `{origin}/modelos/{slug}` — el deep-link que el server
 * resuelve con el teaser blureado + gate para el visitante anónimo.
 */

import { useEffect, useRef, useState } from 'react'
import { modelGroupSlug } from '@/lib/content/model-slug'

interface ShareModelButtonProps {
  modelName: string
  styleName: string | null | undefined
  tipologiaCode: string | null | undefined
  variant?: 'inline' | 'sticky'
}

export default function ShareModelButton({
  modelName,
  styleName,
  tipologiaCode,
  variant = 'inline',
}: ShareModelButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const slug = modelGroupSlug({
    style_name: styleName,
    tipologia_code_new: tipologiaCode,
  })
  // Texto del preview en WhatsApp / cuerpo de mail. El nombre del modelo NO va
  // acá porque ya aparece en el preview del link (Open Graph metadata del
  // page /modelos/[slug] genera title + image). El subject del mail sí lo lleva.
  const shareText = 'Mirá esta casa que encontré en ConstruirFácil'

  const buildUrl = () =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/modelos/${slug}`

  const handleClick = () => {
    // Antes intentábamos navigator.share (Web Share API nativo), pero en desktop
    // abre el sheet del sistema operativo con TODAS las extensiones instaladas,
    // lo cual sobra. Mantenemos siempre el popover acotado: solo WhatsApp + Mail
    // (+ Copiar URL), que es el behavior deseable para el catálogo.
    setOpen((v) => !v)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl())
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1400)
    } catch {
      /* clipboard puede fallar en http no-localhost — el user puede seleccionar el texto */
    }
  }

  const handleWhatsApp = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${buildUrl()}`)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`Mirá esta casa: ${modelName}`)
    const body = encodeURIComponent(`${shareText}\n\n${buildUrl()}\n`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
    setOpen(false)
  }

  // Click afuera + ESC cierra el popover.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div
      className={`cf-share ${variant === 'sticky' ? 'cf-share--sticky' : 'cf-share--inline'}`}
      ref={wrapRef}
    >
      <button
        type="button"
        onClick={handleClick}
        className="cf-share-trigger"
        aria-label={`Compartir ${modelName}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ShareIcon />
        <span className="cf-share-trigger-label">Compartir</span>
      </button>
      {open && (
        <div className="cf-share-popover" role="menu">
          <button
            type="button"
            onClick={handleCopy}
            role="menuitem"
            className="cf-share-option"
          >
            <LinkIcon />
            <span>{copied ? '¡URL copiada!' : 'Copiar URL'}</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            role="menuitem"
            className="cf-share-option"
          >
            <WhatsAppIcon />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleEmail}
            role="menuitem"
            className="cf-share-option"
          >
            <MailIcon />
            <span>Email</span>
          </button>
        </div>
      )}
    </div>
  )
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
    </svg>
  )
}

function WhatsAppIcon() {
  // Logo oficial de WhatsApp en verde — solo el glifo en color de marca.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  )
}
