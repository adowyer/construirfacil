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

interface HeroRowProps {
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  lineas?: LineaRow[]
  lineaCoverByName?: Record<string, string | null>
  growthPairs?: GrowthPair[]
  /** Map de nombre de línea (UPPERCASE) → array de URLs de fotos del catálogo
   *  para esa línea. Usado por LineaModal para el marquee infinito. */
  lineaPhotosByName?: Record<string, string[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Animación Casa que Crece (background para Slide 2)
// ─────────────────────────────────────────────────────────────────────────────
function HouseGrowBg({ pairs }: { pairs: GrowthPair[] }) {
  const images = useMemo(() => pairs.flatMap((p) => [p.img1, p.img2]), [pairs])
  const [activeIdx, setActiveIdx] = useState(0)
  const [prevIdx, setPrevIdx] = useState(-1)

  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setActiveIdx((current) => {
        setPrevIdx(current)
        return (current + 1) % images.length
      })
    }, 2400)
    return () => clearInterval(id)
  }, [images.length])

  if (images.length === 0) return <div className="cf-hero-crece-bg cf-hero-crece-bg-empty" />

  return (
    <>
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
    </>
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
          {section.long.map((b) => (
            <div key={b.name} className="cf-hero-modal-bullet">
              <p className="cf-hero-modal-bullet-name">{b.name}</p>
              <p className="cf-hero-modal-bullet-body">{b.body}</p>
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
function SlidePasos() {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-olive cf-slide-solid-pasos">
      <h2 className="cf-slide-title-pasos">4 Simples pasos para acceder a<br />tu nueva casa 100% financiada.</h2>
      <div className="cf-pasos-grid">
        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Elegí la línea de la casa que te gusta y nuestro Agente de Inteligencia Artificial te ayudará con la escala.
          </p>
          <div className="cf-step-item">ELEGÍ <img src="/Flecha-Roja.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Cotizamos la casa que se adapta a tus posibilidades con un innovador sistema de financiación.
          </p>
          <div className="cf-step-item">COTIZÁ <img src="/Flecha-naranja.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Una vez precalificado tu crédito, sumate a un "grupo" de viviendas en cuotas con un mínimo pago condicional.
          </p>
          <div className="cf-step-item">POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Con el grupo completo al "cupo" de la zona, comenzamos la obra y en pocos meses estarás mudado a tu nueva casa.
          </p>
          <div className="cf-step-item">DISFRUTÁ <img src="/Flecha-verde.png" className="cf-step-arrow-img" alt="" /></div>
        </div>
      </div>
    </div>
  )
}

// Slide 2: Crece (Split Left)
function SlideCrece({ growthPairs, onOpenModal }: { growthPairs: GrowthPair[], onOpenModal: () => void }) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-split">
      <div className="cf-slide-split-image">
        <HouseGrowBg pairs={growthPairs} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.35)', zIndex: 3, pointerEvents: 'none' }} />
        <div className="cf-glass-card left" style={{ zIndex: 10, justifyContent: 'center' }}>
          <p className="cf-pn-eyebrow" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase' }}>Concepto</p>
          <h3 className="cf-hero-slide-crece-title">La Casa que Crece</h3>
          <p className="cf-hero-slide-crece-body">Nos propusimos crear un ambiente que acompañe cada etapa de la vida familiar, y después de mucho trabajo e investigación, la idea original de un gran arquitecto como Alvar Aalto nos dio la respuesta que buscábamos. Una vivienda que evoluciona junto a quienes la habitan.</p>
          <button className="cf-hero-more-btn" onClick={onOpenModal} style={{ marginTop: 'auto' }}>Ver más →</button>
        </div>
        <div className="cf-steps-footer cf-steps-footer-left" style={{ bottom: '30px', left: '40px', zIndex: 10 }}>
          <div className="cf-step-item" style={{ color: '#fff' }}>
            <span style={{ fontSize: '40px', marginRight: '6px', color: '#ff003d', display: 'inline-block', transform: 'rotate(90deg)', lineHeight: 1 }}>&darr;</span>
            4 SIMPLES PASOS PARA SER DUEÑO
          </div>
        </div>
      </div>
      <div className="cf-slide-split-panel" style={{ justifyContent: 'flex-end', paddingBottom: '60px' }}>
        <img src="/la-casa-que-crece.png" alt="La casa que crece" className="cf-panel-logo" style={{ maxWidth: '220px', maxHeight: '180px', marginBottom: 0, width: '100%' }} />
      </div>
    </div>
  )
}

// Slide 3: Principal / Central (Dark Solid)
// Reveal cinematográfico del título + barrido coloreado que sigue el mouse.
// El COLOR del barrido interpola entre los 4 colores de los chevrons debajo,
// según la X del cursor (rojo → naranja → celeste → teal). Posición:
// `bgPos = (250 - cursorX*2) / 3` (válido para background-size: 250%).
const SWEEP_COLOR_STOPS: { x: number; rgb: [number, number, number] }[] = [
  { x: 12.5, rgb: [0xE6, 0x40, 0x4A] }, // rojo — ELEGÍ
  { x: 37.5, rgb: [0xE4, 0x90, 0x30] }, // naranja — COTIZÁ
  { x: 62.5, rgb: [0x3C, 0x9C, 0xD8] }, // celeste — POSTULÁ
  { x: 87.5, rgb: [0x54, 0x90, 0x84] }, // teal — DISFRUTÁ
]

function lerpSweepColor(cursorX: number): string {
  if (cursorX <= SWEEP_COLOR_STOPS[0].x) {
    const [r, g, b] = SWEEP_COLOR_STOPS[0].rgb
    return `rgb(${r}, ${g}, ${b})`
  }
  const last = SWEEP_COLOR_STOPS[SWEEP_COLOR_STOPS.length - 1]
  if (cursorX >= last.x) {
    const [r, g, b] = last.rgb
    return `rgb(${r}, ${g}, ${b})`
  }
  for (let i = 0; i < SWEEP_COLOR_STOPS.length - 1; i++) {
    const a = SWEEP_COLOR_STOPS[i]
    const b = SWEEP_COLOR_STOPS[i + 1]
    if (cursorX >= a.x && cursorX <= b.x) {
      const t = (cursorX - a.x) / (b.x - a.x)
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t)
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t)
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t)
      return `rgb(${r}, ${g}, ${bl})`
    }
  }
  const [r, g, b] = SWEEP_COLOR_STOPS[0].rgb
  return `rgb(${r}, ${g}, ${b})`
}

function SlidePrincipal() {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    let f2 = 0
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => setRevealed(true))
    })
    return () => {
      cancelAnimationFrame(f1)
      if (f2) cancelAnimationFrame(f2)
    }
  }, [])

  const handleTitleMove = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const cursor = ((e.clientX - rect.left) / rect.width) * 100
    const bgPos = Math.max(0, Math.min(100, (250 - cursor * 2) / 3))
    el.style.setProperty('--cf-sweep-x', `${bgPos}%`)
    el.style.setProperty('--cf-sweep-color', lerpSweepColor(cursor))
  }

  const handleTitleLeave = (e: React.MouseEvent<HTMLHeadingElement>) => {
    // vuelve al rest = sin color visible (gradiente fuera del viewport)
    e.currentTarget.style.setProperty('--cf-sweep-x', '100%')
  }

  return (
    <div className={`cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-dark cf-slide-principal-card${revealed ? ' cf-principal-revealed' : ''}`}>
      <h2
        className="cf-slide-title-large cf-principal-scale"
        style={{ marginBottom: '60px' }}
        onMouseMove={handleTitleMove}
        onMouseLeave={handleTitleLeave}
      >
        La casa que querés, en las<br />condiciones que necesitás.
      </h2>
      <StepsFooter />
    </div>
  )
}

// Slide 4: Flex Build Suit (Split Right)
function SlideFlex({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-split cf-slide-split-right">
      <div className="cf-slide-split-panel" style={{ justifyContent: 'flex-end', paddingBottom: '60px' }}>
        <img src="/Flex-Build-Suit.png" alt="Flex Build Suit" className="cf-panel-logo" style={{ maxWidth: '220px', maxHeight: '180px', marginBottom: 0, width: '100%' }} />
      </div>
      <div className="cf-slide-split-image" style={{ backgroundImage: "url('/Fabrica-ARQUIMA.jpg')" }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1 }} />
        <div className="cf-glass-card right" style={{ zIndex: 10, justifyContent: 'center' }}>
          <p className="cf-pn-eyebrow" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Sistema</p>
          <h3 className="cf-hero-slide-crece-title">Flex Build Suit</h3>
          <p className="cf-hero-slide-crece-body">Quienes hacemos Hausind® ya hemos acompañado a miles de familias a tener hogares eficientes, modernos y accesibles, en todo el país. Más de 50.000 M2 de experiencia nos avalan.</p>
          <button className="cf-hero-more-btn" onClick={onOpenModal} style={{ marginTop: 'auto' }}>Ver más →</button>
        </div>
        <div className="cf-steps-footer cf-steps-footer-right" style={{ zIndex: 10 }}>
          <div className="cf-step-item">
            DEFINÍ TU BÚSQUEDA EN EL MENÚ
            <span style={{ fontSize: '40px', marginLeft: '6px', color: '#ff003d', display: 'inline-block', lineHeight: 1 }}>&darr;</span>
          </div>
        </div>
      </div>
    </div>
  )
}



// Slide 5: Lineas
// Slide 5: Intro de líneas (texto solo, vertical compacto)
function SlideLineasIntro() {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-lineas-intro">
      <p className="cf-pn-eyebrow" style={{ color: '#aaa' }}>TRES LÍNEAS, TRES MUNDOS</p>
      <h3 className="cf-slide-lineas-title">Encontrá la<br />línea que<br />mejor se<br />adapta a vos</h3>
      <p className="cf-slide-lineas-body">De casas premium a soluciones modulares. Cada línea responde a un estilo de vida diferente.</p>
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
}: {
  name: string
  sub: string
  bg: string
  teaser: string
  onOpenModal: () => void
}) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-linea-card" style={{ backgroundImage: `url('${bg}')` }}>
      <div className="cf-slide-linea-overlay">
        <h4 className="cf-slide-linea-name">{name}</h4>
        <p className="cf-slide-linea-sub">{sub}</p>
        <p className="cf-slide-linea-teaser">{teaser}</p>
        <button type="button" className="cf-slide-linea-more-btn" onClick={onOpenModal}>
          Ver más +
        </button>
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
    dbKey: 'BOSQUE',
    sub: 'Standard | Ecológica',
    bg: '/bosque.jpg',
    teaser:
      'Homenaje a la madera. Casas modernas y minimalistas, con nombres de especies nativas de nuestra mesopotamia.',
    about:
      'Nuestra Línea de casas HAUSIND® BOSQUE es un merecido homenaje al más cálido, sustentable y noble de los materiales usados en la construcción en todo el mundo: La madera. Nombradas con nombres de especies nativas de nuestra mesopotamia, donde se emplaza nuestra producción de unidades de base Wood Plus, la Línea BOSQUE se expresa en viviendas modernas, minimalistas de alta eficiencia habitacional, con potencial de crecimiento orgánico, y siempre con la heterogeneidad de estilos que demanda el mercado. Se desarrolla a partir de 3 distribuciones internas de sus ambientes, a las que llamamos "tipologías", y en cada una de ellas, variantes de estilo con acabados y materiales para todos los gustos y presupuestos. La Línea BOSQUE se puede fabricar, según preferencia, presupuesto y lugar de implantación, en 2 de nuestros 3 modos constructivos de base; Wood Plus (estructura de madera misionera tratada de larga durabilidad, panelizada en nuestras plantas), ó Steel Plus (paneles de madera SIP o WFP de alta durabilidad y óptima aislación termoacústica producidos en nuestras plantas, sobre una sólida estructura de perfiles de acero).',
  },
  {
    name: 'Atlas',
    dbKey: 'ATLAS',
    sub: 'Estándar | Simétrica',
    bg: '/atlas.jpg',
    teaser:
      'Inspirada en regiones arquitectónicamente emblemáticas del planeta. Heterogeneidad de estilos para cada familia.',
    about:
      'Inspirada en regiones arquitectónicamente emblemáticas del planeta, nuestra Línea de casas HAUSIND® ATLAS busca representar la heterogeneidad de estilos que demanda el mercado, adaptando su estética a una funcionalidad siempre eficiente y armónica. Cada estilo de vivienda se asocia a un diseño exterior e interior acorde, pero sobre todo transmite un estilo de vida, que se expresa en materiales, acabados, terminaciones, revestimientos, muebles y artefactos específicos para cada uno de ellos. Se desarrolla a partir de 2 distribuciones internas de sus ambientes, a las que llamamos "tipologías", y en cada una de ellas hay variantes visuales para cada tipo de cliente y familia. La Línea ATLAS, cuyo concepto constructivo es el más asociado a la idea de "La Casa que Crece", se puede fabricar, según el presupuesto, la preferencia del cliente y lugar de implantación, en 2 de nuestros 3 modos constructivos de base; Wood Plus (estructura de madera misionera tratada de larga durabilidad, panelizada en nuestras plantas), ó Steel Plus (estructura de acero galvanizado con paneles SIP o WFP de alta durabilidad y óptima aislación termoacústica, producidos en nuestras plantas).',
  },
  {
    name: 'Terra',
    dbKey: 'TERRA',
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
  photos,
}: {
  open: boolean
  onClose: () => void
  linea: LineaInfo | null
  photos: string[]
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

  // Duplicamos el array para que el marquee loopee sin "salto" cuando vuelve
  // al inicio (la animación translateX(-50%) cae justo en el final del primer set).
  const marqueePhotos = photos.length > 0 ? [...photos, ...photos] : []

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
        <p className="cf-pn-eyebrow">Línea {linea.dbKey}</p>
        <h2 className="cf-linea-modal-title">{linea.name}</h2>
        <p className="cf-linea-modal-sub">{linea.sub}</p>
        {marqueePhotos.length > 0 && (
          <div className="cf-linea-modal-marquee">
            <div className="cf-linea-modal-marquee-track">
              {marqueePhotos.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="cf-linea-modal-marquee-photo"
                  style={{ backgroundImage: `url('${src}')` }}
                />
              ))}
            </div>
          </div>
        )}
        <p className="cf-linea-modal-body">{linea.about}</p>
      </div>
    </dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export default function HeroRow({
  brandContent = [],
  growthPairs = [],
  lineaPhotosByName = {},
}: HeroRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  // Modals state
  const [modalSection, setModalSection] = useState<HeroSection | null>(null)
  const [modalLinea, setModalLinea] = useState<LineaInfo | null>(null)

  // Carga inicial: scroll al Centro (Slide 3 = índice 2)
  const principalIdx = 2
  const [current, setCurrent] = useState(principalIdx)

  const centerSlide = useCallback((i: number, smooth = true) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement | undefined
    if (!slide) return
    const target = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2
    track.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    centerSlide(principalIdx, false)
    setCurrent(principalIdx)
  }, [principalIdx, centerSlide])

  const snapTo = useCallback(
    (i: number) => {
      centerSlide(i, true)
      setCurrent(i)
    },
    [centerSlide],
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
    setCurrent(closestIdx)
  }, [])

  // Data hardcodeada para Modals
  const modalCrece: HeroSection = useMemo(() => ({
    id: 'crece',
    eyebrow: 'Concepto',
    title: 'La Casa que Crece',
    intro: 'Nos propusimos crear un ambiente que acompañe cada etapa de la vida familiar, y después de mucho trabajo e investigación, la idea original de un gran arquitecto como Alvar Aalto nos dio la respuesta que buscábamos. Una vivienda que evoluciona junto a quienes la habitan. Su diseño formal y espacial permite ampliaciones naturales y fluidas, anticipándose a las necesidades que naturalmente traerá el desarrollo familiar.',
    short: [],
    long: [
      { name: '', body: 'La propuesta de La Casa que Crece parte de una vivienda compacta, funcional y confortable, que integra living-comedor y cocina en un espacio único, con un baño amplio, lavadero exterior y diversos accesorios opcionales para optimizar el jardín, como parrilla, cochera y espacios semicubiertos. Esa casa mínima puede expandirse de manera flexible con cuartos adicionales, más baños, toilette, escritorio o lavadero interior, sin demoliciones ni molestias.' },
      { name: '', body: 'La Casa que Crece brinda la opción de elegir entre distintas distribuciones y disposiciones interiores de sus ambientes, a través de dos tipologías de diseño flexible. Esta visión permite anticipar cómo será el crecimiento de tu hogar antes de construirlo, adecuando la decisión de compra en función del presupuesto actual, pero con la certeza de contar con un desarrollo futuro práctico, adaptable y en sintonía con cada estilo de vida.' }
    ]
  }), [])

  const modalFlex: HeroSection = useMemo(() => ({
    id: 'flex',
    eyebrow: 'Sistema',
    title: 'Flex Build Suit',
    intro: 'Quienes hacemos Hausind® ya hemos acompañado a miles de familias a tener hogares eficientes, modernos y accesibles, en todo el país. Más de 50.000 M2 de experiencia avalan nuestro equipo de arquitectos, ingenieros y expertos en construcción industrializada. Por eso en cada proyecto podemos garantizar precio, tiempo y calidad, en un proceso sin sorpresas y con resultados extraordinarios.',
    short: [],
    long: [
      { name: 'VERDADERAS CASAS', body: 'Usamos la tecnología para industrializar los procesos, pero no fabricamos módulos ni boxes ni nada por el estilo. Hacemos casas, como la que buscas, pero con condiciones superiores que permiten los avances técnicos.' },
      { name: 'CASAS QUE NO SE CONSTRUYEN', body: 'Las casas HAUSIND® no se construyen, se fabrican bajo un modelo industrializado de alta performance inspirado en la industria automotriz, que permite una escala inigualable, gran velocidad de implantación y mejores costos comparativos. Conocé todos los detalles del Sistema HAUSIND® Flex Build Suite en este enlace' },
      { name: 'CASAS DE DISEÑO INTELIGENTE', body: '¿Ya viste nuestras casas? Seguro alguna te gustó. Pero lo mejor de nuestros diseños no se ve. Cada espacio está detalladamente previsto para su uso, y la flexibilidad es nuestro diferencial. Cambiar la distribución interna y crecer sin obras ni demoliciones, es muy fácil.' },
      { name: 'CASAS AMIGABLES', body: 'La preservación e integración con el entorno natural es una premisa fundamental. Privilegiamos los recursos locales al máximo, sugerimos el uso de la madera como protagonista, y las opciones en hormigón son de bajo impacto, elaboradas 100% en plantas industriales bajo estrictas normas de reducción del impacto.' }
    ]
  }), [])

  const numSlides = 8

  return (
    <div className="cf-hero-row">
      <div ref={trackRef} className="cf-hero-row-track" onScroll={onScroll}>
        <div className="cf-hero-row-slide cf-hero-row-slide-section">
          <SlidePasos />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-split">
          <SlideCrece growthPairs={growthPairs} onOpenModal={() => { if (modalCrece) setModalSection(modalCrece) }} />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-principal">
          <SlidePrincipal />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-split">
          <SlideFlex onOpenModal={() => { if (modalFlex) setModalSection(modalFlex) }} />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-lineas-intro">
          <SlideLineasIntro />
        </div>
        {LINEAS.map((linea) => (
          <div key={linea.name} className="cf-hero-row-slide cf-hero-row-slide-linea">
            <SlideLineaCard
              name={linea.name}
              sub={linea.sub}
              bg={linea.bg}
              teaser={linea.teaser}
              onOpenModal={() => setModalLinea(linea)}
            />
          </div>
        ))}

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
        photos={modalLinea ? (lineaPhotosByName[modalLinea.dbKey] ?? []) : []}
      />
    </div>
  )
}
