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
import { buildCotizarMailto } from '@/lib/cta/mailto'

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
        <div className="cf-hero-modal-cta-row">
          <a
            href={buildCotizarMailto()}
            className="cf-hero-modal-cta-primary"
          >
            Cotizar →
          </a>
          {/* "Hablar con un asesor" oculto temporalmente. */}
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
            Una vez preadjudicado tu crédito, postulás para el "cupo" de viviendas en curso, con un mínimo pago condicional.
          </p>
          <div className="cf-step-item">POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt="" /></div>
        </div>

        <div className="cf-paso-col">
          <p className="cf-pasos-text">
            Cuando se completa el "cupo" del barrio comenzamos la obra y en pocas semanas te mudás a tu nueva casa.
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
            <span className="cf-hero-arrow-pointer cf-hero-arrow-pointer-rotated" aria-hidden>&darr;</span>
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
// Typewriter effect con cursor rojo titilante + flechas señaladoras
// arriba/abajo de la frase. Los chevrons abajo se encienden de derecha a
// izquierda en cascada continua (CSS).
const PRINCIPAL_TEXT = 'La casa que querés, en las\ncondiciones que necesitás.'

function SlidePrincipal() {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    let interval = 0 as unknown as ReturnType<typeof setInterval>
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i++
        if (i >= PRINCIPAL_TEXT.length) {
          setTyped(PRINCIPAL_TEXT)
          setDone(true)
          clearInterval(interval)
          return
        }
        setTyped(PRINCIPAL_TEXT.slice(0, i))
      }, 75)
    }, 400)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-dark cf-slide-principal-card">
      <h2 className="cf-slide-title-large cf-principal-typewriter" style={{ marginBottom: '60px' }}>
        {typed}
        <span className={`cf-typewriter-cursor${done ? ' cf-typewriter-cursor-done' : ''}`} aria-hidden>|</span>
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
            <span className="cf-hero-arrow-pointer cf-hero-arrow-pointer-down" aria-hidden>&darr;</span>
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
        <div className="cf-hero-modal-cta-row">
          <a
            href={buildCotizarMailto({ linea: linea.name })}
            className="cf-hero-modal-cta-primary"
          >
            Cotizar línea {linea.name} →
          </a>
          {/* "Hablar con un asesor" oculto temporalmente. */}
        </div>
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
  const [paused, setPaused] = useState(false)

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

  const numSlides = 8

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
    setCurrent(closestIdx % numSlides)
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

  // Auto-carousel marquee: rAF loop que avanza scrollLeft a velocidad
  // constante (px/frame). Para el loop sin saltos, los slides se renderean
  // duplicados (set A + set B). Cuando scrollLeft alcanza el inicio del
  // set B, restamos el ancho del set A → scrollLeft vuelve al inicio del
  // set A en una posición visualmente idéntica (teleport invisible).
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
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
  }, [numSlides])

  // Renderiza el set de 8 slides una vez. Se llama dos veces (set A + set B)
  // para que el rAF loop pueda hacer wraparound invisible.
  const renderSlideSet = (keyPrefix: string) => (
    <>
      <div key={`${keyPrefix}-pasos`} className="cf-hero-row-slide cf-hero-row-slide-section">
        <SlidePasos />
      </div>
      <div key={`${keyPrefix}-crece`} className="cf-hero-row-slide cf-hero-row-slide-split">
        <SlideCrece growthPairs={growthPairs} onOpenModal={() => { if (modalCrece) setModalSection(modalCrece) }} />
      </div>
      <div key={`${keyPrefix}-principal`} className="cf-hero-row-slide cf-hero-row-slide-principal">
        <SlidePrincipal />
      </div>
      <div key={`${keyPrefix}-flex`} className="cf-hero-row-slide cf-hero-row-slide-split">
        <SlideFlex onOpenModal={() => { if (modalFlex) setModalSection(modalFlex) }} />
      </div>
      <div key={`${keyPrefix}-lineas-intro`} className="cf-hero-row-slide cf-hero-row-slide-lineas-intro">
        <SlideLineasIntro />
      </div>
      {LINEAS.map((linea) => (
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
    </>
  )

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
        photos={modalLinea ? (lineaPhotosByName[modalLinea.dbKey] ?? []) : []}
      />
    </div>
  )
}
