'use client'

/**
 * components/catalog/HeroRow.tsx
 *
 * Slider editorial superior del catálogo. 5 slides modulares:
 *   [1. Pasos] ← [2. Crece] ← [3. Central] → [4. Flex] → [5. Líneas]
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { BrandContent, LineContent } from './HeroSlider'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import type {
  HeaderSlide,
  HeaderSlideKind,
} from '@/lib/supabase/queries/header_content'
import { HEADER_DEFAULTS } from '@/lib/content/header-defaults'
import { buildCotizarMailto } from '@/lib/cta/mailto'
import { useInViewport } from '@/lib/hooks/useInViewport'

type HeroBullet = { name: string; body: string }
type HeroSection = {
  id: string
  eyebrow: string
  title: string
  intro?: string
  short: HeroBullet[]
  long: HeroBullet[]
}

export interface GrowthPair {
  name: string
  img1: string
  img2: string
}

/** Modelo único de una línea (agrupado por style_name) — usado por LineaModal
 *  para renderizar la grid de modelos disponibles en cada línea. */
export interface LineaModelo {
  style_name: string
  display_name: string
  cover_url: string | null
  lqip_color: string
  estilo: string
  tipologias: string[]
  group_slugs: string[]
}

interface HeroRowProps {
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  /** Fase 2: contenido editable del header resuelto (versión CF o de la
   *  marca). Sin filas → cada slide cae a su hardcoded (cero regresión). */
  headerSlides?: HeaderSlide[]
  lineas?: LineaRow[]
  lineaCoverByName?: Record<string, string | null>
  growthPairs?: GrowthPair[]
  /** Map de nombre de línea (UPPERCASE) → array de URLs de fotos del catálogo
   *  para esa línea. Usado por LineaModal para el marquee infinito. */
  lineaPhotosByName?: Record<string, string[]>
  /** Map de nombre de línea (UPPERCASE) → modelos únicos por style_name de
   *  esa línea. Usado por LineaModal para mostrar la grid de modelos. */
  modelosByLineaName?: Record<string, LineaModelo[]>
  /** Si está definida, hace clickable el slide Principal (slide 3) — al
   *  hacer click se dispara este callback. Pensado para que, cuando la home
   *  está en modo `home` (catálogo cerrado), el slide actúe como "Ver
   *  catálogo". En modo catálogo se deja undefined → slide no clickable
   *  (cero regresión). */
  onVerCatalogo?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Animación Casa que Crece (background para Slide 2)
// ─────────────────────────────────────────────────────────────────────────────
function HouseGrowBg({ pairs }: { pairs: GrowthPair[] }) {
  const images = useMemo(() => pairs.flatMap((p) => [p.img1, p.img2]), [pairs])
  const [activeIdx, setActiveIdx] = useState(0)
  const [prevIdx, setPrevIdx] = useState(-1)
  const { ref, inView } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (images.length <= 1) return
    if (!inView) return // pausamos el cross-fade fuera del viewport
    const id = setInterval(() => {
      setActiveIdx((current) => {
        setPrevIdx(current)
        return (current + 1) % images.length
      })
    }, 2400)
    return () => clearInterval(id)
  }, [images.length, inView])

  if (images.length === 0)
    return <div ref={ref} className="cf-hero-crece-bg cf-hero-crece-bg-empty" />

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {images.map((url, i) => {
        const isActive = i === activeIdx
        const isPrev = i === prevIdx
        return (
          <div
            key={`${url}-${i}`}
            className={`cf-hero-crece-bg ${isActive ? 'cf-hero-crece-bg-1' : isPrev ? 'cf-hero-crece-bg-2' : 'cf-hero-crece-bg-hide'}`}
            style={{ backgroundImage: `url('${url}')` }}
          />
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal "Ver más"
// ─────────────────────────────────────────────────────────────────────────────
function SectionModal({
  open,
  onClose,
  section,
}: {
  open: boolean
  onClose: () => void
  section: HeroSection | null
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  // Bloquear scroll del body mientras el modal está abierto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!section) return null

  return (
    <dialog
      ref={dialogRef}
      className="cf-hero-modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      onClose={onClose}
    >
      <div className="cf-hero-modal-inner">
        <button type="button" className="cf-hero-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <p className="cf-pn-eyebrow">{section.eyebrow}</p>
        <h2 className="cf-hero-modal-title">{section.title}</h2>
        {section.intro && <p className="cf-hero-modal-intro">{section.intro}</p>}
        <div className="cf-hero-modal-bullets">
          {section.long.map((b, i) => (
            <div key={b.name || i} className="cf-hero-modal-bullet">
              {b.name && (
                <p className="cf-hero-modal-bullet-name">{b.name}</p>
              )}
              <div
                className="cf-hero-modal-bullet-body cf-richtext"
                dangerouslySetInnerHTML={{ __html: b.body }}
              />
            </div>
          ))}
        </div>
      </div>
    </dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Components compartidos
// ─────────────────────────────────────────────────────────────────────────────
function StepsFooter() {
  return (
    <div className="cf-steps-footer">
      <div className="cf-step-item">ELEGÍ <img src="/Flecha-Roja.png" className="cf-step-arrow-img" alt="" /></div>
      <div className="cf-step-item">COTIZÁ <img src="/Flecha-naranja.png" className="cf-step-arrow-img" alt="" /></div>
      <div className="cf-step-item">POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt="" /></div>
      <div className="cf-step-item">DISFRUTÁ <img src="/Flecha-verde.png" className="cf-step-arrow-img" alt="" /></div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slides Individuales Modulares
// ─────────────────────────────────────────────────────────────────────────────

// Slide 1: Pasos (Olive Solid)
function SlidePasos({ s }: { s?: HeaderSlide }) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-olive cf-slide-solid-pasos">
      <h2 className="cf-slide-title-pasos">
        {s?.title || HEADER_DEFAULTS.pasos?.title}
      </h2>
      <div className="cf-pasos-grid">
        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Elegí la línea de la casa que te gusta y nuestro Agente de Inteligencia Artificial te ayudará a alcanzarla.
          </p>
          <div className="cf-step-item">ELEGÍ <img src="/Flecha-Roja.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Construimos la casa que se adapta a tus posibilidades, con varias alternativas de financiación.
          </p>
          <div className="cf-step-item">COTIZÁ <img src="/Flecha-naranja.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Una vez preadjudicado tu crédito, postulás para el cupo de viviendas en curso, con un mínimo pago condicional.
          </p>
          <div className="cf-step-item">POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Cuando se completa el cupo del barrio comenzamos la obra y en pocas semanas te mudás a tu nueva casa.
          </p>
          <div className="cf-step-item">DISFRUTÁ <img src="/Flecha-verde.png" className="cf-step-arrow-img" alt="" /></div>
        </div>
      </div>
    </div>
  )
}

// Si el admin configuró `cta_url` apuntando al catálogo interno
// (`/catalogo*`), preferimos desplegarlo inline cuando estamos en la home
// (`onVerCatalogo` disponible) en vez de navegar — sino el slide hace una
// nav de página completa, perdiendo la sensación de catálogo siempre presente.
function isInternalCatalogUrl(url: string | null | undefined): boolean {
  return !!url && (url === '/catalogo' || url.startsWith('/catalogo/'))
}

// Slide 2: Crece (Split Left)
function SlideCrece({ growthPairs, onOpenModal, onVerCatalogo, s }: { growthPairs: GrowthPair[], onOpenModal: () => void, onVerCatalogo?: () => void, s?: HeaderSlide }) {
  const ctaLabel = s?.cta_label?.trim() || 'Ver más'
  const ctaToCatalog = isInternalCatalogUrl(s?.cta_url) && !!onVerCatalogo
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-split">
      <div
        className="cf-slide-split-image"
        style={
          s?.image_url ? { backgroundImage: `url('${s.image_url}')` } : undefined
        }
      >
        {/* Fondo editable: imagen/GIF de la DB; sin foto → cross-fade actual
            del catálogo (cero regresión). Mismo container/overlay/glass-card. */}
        {!s?.image_url && <HouseGrowBg pairs={growthPairs} />}
        <div className="cf-glass-card left" style={{ zIndex: 10, justifyContent: 'center' }}>
          <p className="cf-pn-eyebrow" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase' }}>{s?.eyebrow || HEADER_DEFAULTS.crece?.eyebrow}</p>
          <h3 className="cf-hero-slide-crece-title">{s?.title || HEADER_DEFAULTS.crece?.title}</h3>
          <div
            className="cf-hero-slide-crece-body cf-richtext"
            dangerouslySetInnerHTML={{
              __html: s?.body || HEADER_DEFAULTS.crece?.body || '',
            }}
          />
          {ctaToCatalog ? (
            <button className="cf-hero-more-btn" onClick={onVerCatalogo} style={{ marginTop: 'auto' }}>{ctaLabel} →</button>
          ) : s?.cta_url ? (
            <a href={s.cta_url} className="cf-hero-more-btn" style={{ marginTop: 'auto' }}>{ctaLabel} →</a>
          ) : s?.long_body && (
            <button className="cf-hero-more-btn" onClick={onOpenModal} style={{ marginTop: 'auto' }}>{ctaLabel} →</button>
          )}
        </div>
      </div>
      <div className="cf-slide-split-panel" style={{ justifyContent: 'flex-end', paddingBottom: '30px' }}>
        <img src={s?.panel_image_url || '/la-casa-que-crece.png'} alt="La casa que crece" className="cf-panel-logo" style={{ maxWidth: 'clamp(200px, 16vw, 320px)', maxHeight: 'clamp(160px, 13vw, 260px)', marginBottom: 0, width: '100%' }} />
      </div>
    </div>
  )
}

// Slide 3: Principal / Central (Dark Solid)
// Typewriter effect con cursor rojo titilante + flechas señaladoras
// arriba/abajo de la frase. Los chevrons abajo se encienden de derecha a
// izquierda en cascada continua (CSS).
const PRINCIPAL_TEXT = HEADER_DEFAULTS.principal?.title ?? ''

function SlidePrincipal({ s }: { s?: HeaderSlide }) {
  const text = s?.title || PRINCIPAL_TEXT
  const boldTerm = s?.bold_term ?? null
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    let interval = 0 as unknown as ReturnType<typeof setInterval>
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i++
        if (i >= text.length) {
          setTyped(text)
          setDone(true)
          clearInterval(interval)
          return
        }
        setTyped(text.slice(0, i))
      }, 75)
    }, 400)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [text])

  // Renderiza `typed` respetando bold_term: si el typewriter ya pasó por la
  // posición del término, envuelve la porción ya tipeada en <strong>. Insensible
  // a mayúsculas porque el headline puede traer "Rincón" y la localidad
  // "Rincon" (sin tilde) o variantes — comparamos sobre la versión lower.
  const rendered = (() => {
    if (!boldTerm) return typed
    const boldStart = text.toLowerCase().indexOf(boldTerm.toLowerCase())
    if (boldStart === -1) return typed
    const boldEnd = boldStart + boldTerm.length
    if (typed.length <= boldStart) return typed
    const prefix = typed.slice(0, boldStart)
    const boldPortion = typed.slice(boldStart, Math.min(typed.length, boldEnd))
    const suffix = typed.length > boldEnd ? typed.slice(boldEnd) : ''
    return (
      <>
        {prefix}
        <strong>{boldPortion}</strong>
        {suffix}
      </>
    )
  })()

  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-dark cf-slide-principal-card">
      <h2 className="cf-slide-title-large cf-principal-typewriter" style={{ marginBottom: '60px' }}>
        {rendered}
        <span className={`cf-typewriter-cursor${done ? ' cf-typewriter-cursor-done' : ''}`} aria-hidden>|</span>
      </h2>
      <StepsFooter />
    </div>
  )
}

// Slide 4: Flex Build Suit (Split Right)
function SlideFlex({ onOpenModal, onVerCatalogo, s }: { onOpenModal: () => void, onVerCatalogo?: () => void, s?: HeaderSlide }) {
  const ctaLabel = s?.cta_label?.trim() || 'Ver más'
  const ctaToCatalog = isInternalCatalogUrl(s?.cta_url) && !!onVerCatalogo
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-split cf-slide-split-right">
      <div className="cf-slide-split-panel" style={{ justifyContent: 'flex-end', paddingBottom: '30px' }}>
        <img src={s?.panel_image_url || '/Flex-Build-Suit.png'} alt="Flex Build Suit" className="cf-panel-logo" style={{ maxWidth: 'clamp(200px, 16vw, 320px)', maxHeight: 'clamp(160px, 13vw, 260px)', marginBottom: 0, width: '100%' }} />
      </div>
      <div className="cf-slide-split-image" style={{ backgroundImage: `url('${s?.image_url || '/Fabrica-ARQUIMA.jpg'}')` }}>
        <div className="cf-glass-card right" style={{ zIndex: 10, justifyContent: 'center' }}>
          <p className="cf-pn-eyebrow" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{s?.eyebrow || HEADER_DEFAULTS.flex?.eyebrow}</p>
          <h3 className="cf-hero-slide-crece-title">{s?.title || HEADER_DEFAULTS.flex?.title}</h3>
          <div
            className="cf-hero-slide-crece-body cf-richtext"
            dangerouslySetInnerHTML={{
              __html: s?.body || HEADER_DEFAULTS.flex?.body || '',
            }}
          />
          {ctaToCatalog ? (
            <button className="cf-hero-more-btn" onClick={onVerCatalogo} style={{ marginTop: 'auto' }}>{ctaLabel} →</button>
          ) : s?.cta_url ? (
            <a href={s.cta_url} className="cf-hero-more-btn" style={{ marginTop: 'auto' }}>{ctaLabel} →</a>
          ) : s?.long_body && (
            <button className="cf-hero-more-btn" onClick={onOpenModal} style={{ marginTop: 'auto' }}>{ctaLabel} →</button>
          )}
        </div>
      </div>
    </div>
  )
}



// Slide 5: Lineas
// Slide 5: Intro de líneas (texto solo, vertical compacto)
function SlideLineasIntro({ s }: { s?: HeaderSlide }) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-lineas-intro">
      <p className="cf-pn-eyebrow" style={{ color: '#aaa' }}>{s?.eyebrow || HEADER_DEFAULTS['lineas-intro']?.eyebrow}</p>
      <h3 className="cf-slide-lineas-title">{s?.title || HEADER_DEFAULTS['lineas-intro']?.title}</h3>
      <div
        className="cf-slide-lineas-body cf-richtext"
        dangerouslySetInnerHTML={{
          __html: s?.body || HEADER_DEFAULTS['lineas-intro']?.body || '',
        }}
      />
    </div>
  )
}

// Slides 6-8: Una por línea, vertical, con la foto de la línea como bg full,
// teaser de 2 líneas y botón "Ver más" que abre LineaModal.
function SlideLineaCard({
  name,
  sub,
  bg,
  teaser,
  onOpenModal,
  moreLabel = 'Ver más',
}: {
  name: string
  sub: string
  bg: string
  teaser: string
  onOpenModal: () => void
  /** null/'' → sin botón (slide sin texto largo). Default 'Ver más'. */
  moreLabel?: string | null
}) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-linea-card" style={{ backgroundImage: `url('${bg}')` }}>
      <div className="cf-slide-linea-overlay">
        <h4 className="cf-slide-linea-name">{name}</h4>
        <p className="cf-slide-linea-sub">{sub}</p>
        <p className="cf-slide-linea-teaser">{teaser}</p>
        {moreLabel && (
          <button type="button" className="cf-slide-linea-more-btn" onClick={onOpenModal}>
            {moreLabel} +
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Línea Modal: photo gallery + texto completo "Acerca de la línea"
// ─────────────────────────────────────────────────────────────────────────────
type LineaInfo = {
  name: string
  /** Key UPPERCASE para joinear con `lineaPhotosByName` (= `house_catalog.linea`). */
  dbKey: string
  sub: string
  bg: string
  teaser: string
  about: string
}

const LINEAS: LineaInfo[] = [
  {
    name: 'Bosque',
    dbKey: 'LÍNEA BOSQUE',
    sub: 'Standard | Ecológica',
    bg: '/bosque.jpg',
    teaser:
      'Homenaje a la madera. Casas modernas y minimalistas, con nombres de especies nativas de nuestra mesopotamia.',
    about:
      'Nuestra Línea de casas HAUSIND® BOSQUE es un merecido homenaje al más cálido, sustentable y noble de los materiales usados en la construcción en todo el mundo: La madera. Nombradas con nombres de especies nativas de nuestra mesopotamia, donde se emplaza nuestra producción de unidades de base Wood Plus, la Línea BOSQUE se expresa en viviendas modernas, minimalistas de alta eficiencia habitacional, con potencial de crecimiento orgánico, y siempre con la heterogeneidad de estilos que demanda el mercado. Se desarrolla a partir de 3 distribuciones internas de sus ambientes, a las que llamamos "tipologías", y en cada una de ellas, variantes de estilo con acabados y materiales para todos los gustos y presupuestos. La Línea BOSQUE se puede fabricar, según preferencia, presupuesto y lugar de implantación, en 2 de nuestros 3 modos constructivos de base; Wood Plus (estructura de madera misionera tratada de larga durabilidad, panelizada en nuestras plantas), o Steel Plus (paneles de madera SIP o WFP de alta durabilidad y óptima aislación termoacústica producidos en nuestras plantas, sobre una sólida estructura de perfiles de acero).',
  },
  {
    name: 'Atlas',
    dbKey: 'LÍNEA ATLAS',
    sub: 'Estándar | Simétrica',
    bg: '/atlas.jpg',
    teaser:
      'Inspirada en regiones arquitectónicamente emblemáticas del planeta. Heterogeneidad de estilos para cada familia.',
    about:
      'Inspirada en regiones arquitectónicamente emblemáticas del planeta, nuestra Línea de casas HAUSIND® ATLAS busca representar la heterogeneidad de estilos que demanda el mercado, adaptando su estética a una funcionalidad siempre eficiente y armónica. Cada estilo de vivienda se asocia a un diseño exterior e interior acorde, pero sobre todo transmite un estilo de vida, que se expresa en materiales, acabados, terminaciones, revestimientos, muebles y artefactos específicos para cada uno de ellos. Se desarrolla a partir de 2 distribuciones internas de sus ambientes, a las que llamamos "tipologías", y en cada una de ellas hay variantes visuales para cada tipo de cliente y familia. La Línea ATLAS, cuyo concepto constructivo es el más asociado a la idea de "La Casa que Crece", se puede fabricar, según el presupuesto, la preferencia del cliente y lugar de implantación, en 2 de nuestros 3 modos constructivos de base; Wood Plus (estructura de madera misionera tratada de larga durabilidad, panelizada en nuestras plantas), o Steel Plus (estructura de acero galvanizado con paneles SIP o WFP de alta durabilidad y óptima aislación termoacústica, producidos en nuestras plantas).',
  },
  {
    name: 'Terra',
    dbKey: 'LÍNEA TERRA',
    sub: 'Modular | Económica',
    bg: '/terra.jpg',
    teaser:
      'Inspiradas en la cordillera neuquina. Sencillas, funcionales, modernas, con gran expresión estética.',
    about:
      'Nuestra Línea de casas HAUSIND® TERRA remite al noble suelo sobre el que implantamos nuestras creaciones, para ser disfrutadas toda la vida. Inspiradas en la cordillera neuquina, las casas usan nombres de los cerros, volcanes y montañas más admirados y amados de la Patagonia, donde nació la idea de Hausind® y donde tenemos muchos de nuestros principales proyectos. La Línea TERRA se expresa en viviendas sencillas pero muy funcionales, modernas y minimalistas pero con gran expresión estética, y cada uno de los modelos del amplio espectro pone el acento en la calidad habitacional, en la alta eficiencia energética, y en la atención de cada nicho de necesidad, desde el más económico, hasta los más ambiciosos. Se desarrolla a partir de 3 distribuciones internas de sus ambientes, a las que llamamos "tipologías", y en cada una de ellas, variantes visuales exteriores e interiores, con acabados y materiales para todos los gustos y presupuestos. La Línea TERRA se puede fabricar, según preferencia, presupuesto y lugar de implantación, en nuestros 3 modos constructivos de base.',
  },
]

function LineaModal({
  open,
  onClose,
  linea,
  modelos,
}: {
  open: boolean
  onClose: () => void
  linea: LineaInfo | null
  modelos: LineaModelo[]
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  // Bloquear scroll del body mientras el modal está abierto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!linea) return null

  const handleModelClick = (m: LineaModelo) => {
    // Cierra la modal y scrollea al row del primer group_slug del modelo
    // en el catálogo. Doble RAF para esperar el reflow tras el close.
    const targetSlug = m.group_slugs[0]
    onClose()
    if (!targetSlug) return
    window.setTimeout(() => {
      const el = document.getElementById(`row-${targetSlug}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
  }

  return (
    <dialog
      ref={dialogRef}
      className="cf-linea-modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      onClose={onClose}
    >
      <div className="cf-linea-modal-inner">
        <button type="button" className="cf-hero-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <p className="cf-pn-eyebrow">Hausind</p>
        <h2 className="cf-linea-modal-title">Línea {linea.name}</h2>
        <p className="cf-linea-modal-sub">{linea.sub}</p>
        <p className="cf-linea-modal-body">{linea.about}</p>

        {modelos.length > 0 && (
          <section className="cf-linea-modal-modelos">
            <header className="cf-linea-modal-modelos-header">
              <p className="cf-pn-eyebrow">Modelos disponibles</p>
              <h3 className="cf-linea-modal-modelos-title">
                {modelos.length} modelo{modelos.length !== 1 ? 's' : ''} en la
                línea {linea.name}
              </h3>
            </header>
            <div className="cf-linea-modal-modelos-grid">
              {modelos.map((m) => (
                <button
                  key={m.style_name}
                  type="button"
                  className="cf-linea-modal-modelo-card"
                  onClick={() => handleModelClick(m)}
                  style={{
                    backgroundImage: m.cover_url ? `url('${m.cover_url}')` : undefined,
                    backgroundColor: m.cover_url ? undefined : m.lqip_color,
                  }}
                >
                  <div className="cf-linea-modal-modelo-card-overlay">
                    <span className="cf-linea-modal-modelo-card-name">
                      {m.display_name}
                    </span>
                    {m.tipologias.length > 0 && (
                      <span className="cf-linea-modal-modelo-card-tipo">
                        {m.tipologias
                          .map((t) => `Tipología ${t}`)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </dialog>
  )
}

// Fase 2: arma un HeroSection (para el SectionModal "Ver más") a partir de un
// slide editable, SOLO si tiene long_body cargado. Sin long_body → null →
// el botón "Ver más" no se renderiza (sin texto largo no hay nada que abrir).
// NOTA: el slider de fotos del modal (gallery_urls) queda para una fase
// posterior; por ahora el modal genérico muestra título + long_body.
// Slide 'banner' repetible (promo/contenido extra). Diseño fijo: foto +
// overlay si hay image_url; si no, color de fondo. narrow = chico.
function SlideBanner({
  s,
  onOpenModal,
}: {
  s: HeaderSlide
  onOpenModal: () => void
}) {
  const photo = !!s.image_url
  return (
    <div
      className="cf-slide-banner"
      style={
        photo
          ? { backgroundImage: `url('${s.image_url}')` }
          : { background: s.bg || '#0a0a0a' }
      }
    >
      {photo && <div className="cf-slide-banner-overlay" aria-hidden="true" />}
      <div className="cf-slide-banner-content">
        {s.eyebrow && (
          <p
            className="cf-pn-eyebrow"
            style={{ color: '#fff', margin: 0 }}
          >
            {s.eyebrow}
          </p>
        )}
        {s.title && (
          <h3 className="cf-hero-slide-crece-title">{s.title}</h3>
        )}
        {s.body && (
          <div
            className="cf-hero-slide-crece-body cf-richtext"
            dangerouslySetInnerHTML={{ __html: s.body }}
          />
        )}
        {s.cta_url ? (
          <a
            href={s.cta_url}
            className="cf-hero-more-btn"
            style={{ marginTop: 'auto' }}
          >
            {s.cta_label?.trim() || 'Ver más'} →
          </a>
        ) : s.long_body && (
          <button
            className="cf-hero-more-btn"
            onClick={onOpenModal}
            style={{ marginTop: 'auto' }}
          >
            {s.cta_label?.trim() || 'Ver más'} →
          </button>
        )}
      </div>
    </div>
  )
}

function sectionFromSlide(
  s: HeaderSlide | undefined,
  fallbackEyebrow: string,
): HeroSection | null {
  if (!s || !s.long_body) return null
  return {
    id: s.id,
    eyebrow: s.eyebrow ?? fallbackEyebrow,
    title: s.title ?? '',
    intro: undefined,
    short: [],
    long: [{ name: '', body: s.long_body }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export default function HeroRow({
  brandContent = [],
  headerSlides = [],
  lineas = [],
  growthPairs = [],
  lineaPhotosByName = {},
  modelosByLineaName = {},
  onVerCatalogo,
}: HeroRowProps) {
  // Resolver el "sub" (tagline) de cada línea contra el admin (lineas.tagline).
  // Si la DB tiene tagline, override el hardcoded de LINEAS; sino, fallback.
  const lineasResolved = useMemo(() => {
    const taglineByName: Record<string, string> = {}
    for (const l of lineas) {
      if (l.tagline) taglineByName[l.name] = l.tagline
    }
    return LINEAS.map((l) => ({
      ...l,
      sub: taglineByName[l.dbKey] ?? l.sub,
    }))
  }, [lineas])

  // Overrides editables (DB). Singletons: 1 por slide_kind (el primero gana).
  // `linea-card` es repetible → array ordenado (la query ya viene por sort_order).
  const slideByKind = useMemo(() => {
    const m = new Map<HeaderSlideKind, HeaderSlide>()
    for (const s of headerSlides) {
      if (s.slide_kind !== 'linea-card' && !m.has(s.slide_kind)) {
        m.set(s.slide_kind, s)
      }
    }
    return m
  }, [headerSlides])
  const dbLineaCards = useMemo(
    () => headerSlides.filter((s) => s.slide_kind === 'linea-card'),
    [headerSlides],
  )
  const dbBanners = useMemo(
    () => headerSlides.filter((s) => s.slide_kind === 'banner'),
    [headerSlides],
  )

  const trackRef = useRef<HTMLDivElement>(null)

  // Pausamos el auto-carousel marquee cuando el track no está en viewport.
  // Cuando el user scrollea más abajo del Hero, no tiene sentido seguir
  // moviendo el track con rAF.
  const [trackInView, setTrackInView] = useState(true)
  useEffect(() => {
    const el = trackRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setTrackInView(entry.isIntersecting),
      { threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Modals state
  const [modalSection, setModalSection] = useState<HeroSection | null>(null)
  const [modalLinea, setModalLinea] = useState<LineaInfo | null>(null)

  // Carga inicial: scroll al Centro (Slide 3 = índice 2)
  const principalIdx = 2
  const [current, setCurrent] = useState(principalIdx)
  const [paused, setPaused] = useState(false)

  const centerSlide = useCallback((i: number, smooth = true) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement | undefined
    if (!slide) return
    const target = Math.max(0, slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2)
    track.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  /** Scroll animado por rAF con ease-out cubic. El smooth nativo del
   *  browser dura ~300ms y a veces no se percibe; este lo extiende a
   *  ~900ms para que el affordance "hay más a la derecha" se sienta
   *  intencional y no como un glitch. */
  const animatedCenterSlide = useCallback((i: number, duration = 900) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement | undefined
    if (!slide) return
    const target = Math.max(0, slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2)
    const start = track.scrollLeft
    const delta = target - start
    if (Math.abs(delta) < 1) return
    const t0 = performance.now()
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    let rafId = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      track.scrollLeft = start + delta * easeOutCubic(t)
      if (t < 1) rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    // Carga inicial: dejar al primer paint mostrar el slide 1 brevemente y
    // después scrollear suavemente al Principal — el movimiento horizontal
    // conlleva el affordance de "hay más contenido a la derecha", igual que
    // el hint del catálogo desplegado. Browser nativo era muy rápido y se
    // sentía como un jump → custom rAF de 900ms con ease-out.
    const t = setTimeout(() => animatedCenterSlide(principalIdx), 180)
    setCurrent(principalIdx)
    return () => clearTimeout(t)
  }, [principalIdx, animatedCenterSlide])

  // 5 singletons + N cards de línea (DB si hay, sino las hardcoded).
  const numSlides =
    5 +
    (dbLineaCards.length > 0 ? dbLineaCards.length : lineasResolved.length) +
    dbBanners.length

  // snapTo(i) busca la copia de slide i más cercana al scrollLeft actual
  // (set A o set B duplicado) — evita rebobinar cuando el carousel ya pasó
  // del primer set.
  const snapTo = useCallback(
    (i: number) => {
      const track = trackRef.current
      if (!track) return
      const candidates = [i, i + numSlides]
      let bestIdx = i
      let bestDist = Infinity
      for (const idx of candidates) {
        const el = track.children[idx] as HTMLElement | undefined
        if (!el) continue
        const target = el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2
        const dist = Math.abs(track.scrollLeft - target)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = idx
        }
      }
      centerSlide(bestIdx, true)
      setCurrent(bestIdx % numSlides)
    },
    [centerSlide, numSlides],
  )

  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const trackCenter = track.scrollLeft + track.clientWidth / 2
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < track.children.length; i++) {
      const el = track.children[i] as HTMLElement
      const elCenter = el.offsetLeft + el.offsetWidth / 2
      const d = Math.abs(elCenter - trackCenter)
      if (d < closestDist) {
        closestDist = d
        closestIdx = i
      }
    }
    setCurrent(closestIdx % numSlides)
  }, [numSlides])

  // Auto-carousel marquee: rAF loop que avanza scrollLeft a velocidad
  // constante (px/frame). Para el loop sin saltos, los slides se renderean
  // duplicados (set A + set B). Cuando scrollLeft alcanza el inicio del
  // set B, restamos el ancho del set A → scrollLeft vuelve al inicio del
  // set A en una posición visualmente idéntica (teleport invisible).
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    // Si el track no está visible, no arrancamos el rAF — evitamos consumir
    // CPU continuo cuando el user scrolleó fuera del Hero.
    if (!trackInView) return

    const SPEED = 1.4 // px por frame ≈ 84 px/s a 60fps
    const START_DELAY = 5000 // ms — deja que el typewriter del Principal termine
    let rafId = 0
    let started = false

    const tick = () => {
      const track = trackRef.current
      if (!track) return
      if (!pausedRef.current) {
        const firstSlide = track.children[0] as HTMLElement | undefined
        const setBStart = track.children[numSlides] as HTMLElement | undefined
        if (firstSlide && setBStart) {
          const loopAmount = setBStart.offsetLeft - firstSlide.offsetLeft
          let next = track.scrollLeft + SPEED
          if (loopAmount > 0 && next >= setBStart.offsetLeft) {
            next -= loopAmount
          }
          track.scrollLeft = next
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const startTimer = setTimeout(() => {
      started = true
      rafId = requestAnimationFrame(tick)
    }, START_DELAY)

    return () => {
      clearTimeout(startTimer)
      if (started && rafId) cancelAnimationFrame(rafId)
    }
  }, [numSlides, trackInView])

  // Renderiza el set de 8 slides una vez. Se llama dos veces (set A + set B)
  // para que el rAF loop pueda hacer wraparound invisible.
  const renderSlideSet = (keyPrefix: string) => {
    const sPasos = slideByKind.get('pasos')
    const sCrece = slideByKind.get('crece')
    const sPrincipal = slideByKind.get('principal')
    const sFlex = slideByKind.get('flex')
    const sLineasIntro = slideByKind.get('lineas-intro')
    // Modal "Ver más": solo si el slide tiene long_body cargado. Sin
    // long_body → null → no se renderiza el botón (ver SlideCrece/SlideFlex).
    const creceSection = sectionFromSlide(sCrece, 'Concepto')
    const flexSection = sectionFromSlide(sFlex, 'Sistema')
    return (
    <>
      <div key={`${keyPrefix}-pasos`} className="cf-hero-row-slide cf-hero-row-slide-section">
        <SlidePasos s={sPasos} />
      </div>
      <div key={`${keyPrefix}-crece`} className="cf-hero-row-slide cf-hero-row-slide-split">
        <SlideCrece growthPairs={growthPairs} s={sCrece} onOpenModal={() => { if (creceSection) setModalSection(creceSection) }} onVerCatalogo={onVerCatalogo} />
      </div>
      <div
        key={`${keyPrefix}-principal`}
        className="cf-hero-row-slide cf-hero-row-slide-principal"
        onClick={onVerCatalogo}
        role={onVerCatalogo ? 'button' : undefined}
        tabIndex={onVerCatalogo ? 0 : undefined}
        onKeyDown={
          onVerCatalogo
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onVerCatalogo()
                }
              }
            : undefined
        }
        style={onVerCatalogo ? { cursor: 'pointer' } : undefined}
      >
        <SlidePrincipal s={sPrincipal} />
      </div>
      <div key={`${keyPrefix}-flex`} className="cf-hero-row-slide cf-hero-row-slide-split">
        <SlideFlex s={sFlex} onOpenModal={() => { if (flexSection) setModalSection(flexSection) }} onVerCatalogo={onVerCatalogo} />
      </div>
      <div key={`${keyPrefix}-lineas-intro`} className="cf-hero-row-slide cf-hero-row-slide-lineas-intro">
        <SlideLineasIntro s={sLineasIntro} />
      </div>
      {dbLineaCards.length > 0
        ? dbLineaCards.map((s) => (
            <div key={`${keyPrefix}-lc-${s.id}`} className="cf-hero-row-slide cf-hero-row-slide-linea">
              <SlideLineaCard
                name={s.title ?? ''}
                sub={s.subtitle ?? ''}
                bg={s.image_url ?? ''}
                teaser={s.body ?? ''}
                moreLabel={s.long_body ? (s.cta_label?.trim() || 'Ver más') : null}
                onOpenModal={() => { const sec = sectionFromSlide(s, ''); if (sec) setModalSection(sec) }}
              />
            </div>
          ))
        : lineasResolved.map((linea) => (
            <div key={`${keyPrefix}-linea-${linea.name}`} className="cf-hero-row-slide cf-hero-row-slide-linea">
              <SlideLineaCard
                name={linea.name}
                sub={linea.sub}
                bg={linea.bg}
                teaser={linea.teaser}
                onOpenModal={() => setModalLinea(linea)}
              />
            </div>
          ))}
      {dbBanners.map((s) => (
        <div
          key={`${keyPrefix}-bn-${s.id}`}
          className={`cf-hero-row-slide ${
            s.narrow
              ? 'cf-hero-row-slide-lineas-intro'
              : 'cf-hero-row-slide-split'
          }`}
        >
          <SlideBanner
            s={s}
            onOpenModal={() => {
              const sec = sectionFromSlide(s, s.eyebrow ?? '')
              if (sec) setModalSection(sec)
            }}
          />
        </div>
      ))}
    </>
    )
  }

  return (
    <div
      className="cf-hero-row"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={trackRef} className="cf-hero-row-track" onScroll={onScroll}>
        {renderSlideSet('a')}
        {renderSlideSet('b')}
      </div>

      <div className="cf-hero-row-dots">
        {Array.from({ length: numSlides }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`cf-hero-row-dot ${i === current ? 'active' : ''}`}
            onClick={() => snapTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <SectionModal
        open={!!modalSection}
        onClose={() => setModalSection(null)}
        section={modalSection}
      />

      <LineaModal
        open={!!modalLinea}
        onClose={() => setModalLinea(null)}
        linea={modalLinea}
        modelos={modalLinea ? (modelosByLineaName[modalLinea.dbKey] ?? []) : []}
      />
    </div>
  )
}
