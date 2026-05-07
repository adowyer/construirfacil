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
import { HERO_SECTIONS, type HeroSection } from '@/lib/data/heroContent'

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
      <div className="cf-step-item">ELEGÍ <img src="/Flecha-Roja.png" className="cf-step-arrow-img" alt=""/></div>
      <div className="cf-step-item">COTIZÁ <img src="/Flecha-naranja.png" className="cf-step-arrow-img" alt=""/></div>
      <div className="cf-step-item">POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt=""/></div>
      <div className="cf-step-item">DISFRUTÁ <img src="/Flecha-verde.png" className="cf-step-arrow-img" alt=""/></div>
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
      <h2 className="cf-slide-title-pasos">4 Simples pasos para acceder a<br/>tu nueva casa 100% financiada.</h2>
      <div className="cf-pasos-grid">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="cf-pasos-text">
            <strong style={{color: '#fff'}}>Elegí</strong> el estilo de<br/>
            la casa que te gusta<br/>
            y nuestro Agente de<br/>
            Inteligencia Artificial te<br/>
            ayudará a alcanzarla.
          </p>
          <div className="cf-step-item" style={{ marginTop: 'auto', paddingTop: '24px' }}>ELEGÍ <img src="/Flecha-Roja.png" className="cf-step-arrow-img" alt=""/></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="cf-pasos-text">
            <strong style={{color: '#fff'}}>En "La casa que crece"</strong><br/>
            podés agregar o quitar<br/>
            ambientes y accesorios<br/>
            según tu presupuesto, y<br/>
            no resignar tu sueño.
          </p>
          <div className="cf-step-item" style={{ marginTop: 'auto', paddingTop: '24px' }}>COTIZÁ <img src="/Flecha-naranja.png" className="cf-step-arrow-img" alt=""/></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="cf-pasos-text">
            <strong style={{color: '#fff'}}>Una vez preadjudicado</strong><br/>
            tu crédito, postulás para<br/>
            el cupo de viviendas en<br/>
            curso, con un mínimo<br/>
            pago condicional.
          </p>
          <div className="cf-step-item" style={{ marginTop: 'auto', paddingTop: '24px' }}>POSTULÁ <img src="/Flecha-celeste.png" className="cf-step-arrow-img" alt=""/></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="cf-pasos-text">
            <strong style={{color: '#fff'}}>Completado el cupo</strong><br/>
            de clientes aprobados,<br/>
            comenzamos la obra<br/>
            y en pocas semanas te<br/>
            mudas a tu nueva casa.
          </p>
          <div className="cf-step-item" style={{ marginTop: 'auto', paddingTop: '24px' }}>DISFRUTÁ <img src="/Flecha-verde.png" className="cf-step-arrow-img" alt=""/></div>
        </div>
      </div>
    </div>
  )
}

// Slide 2: Crece (Split Left)
function SlideCrece({ growthPairs, onOpenModal, concept }: { growthPairs: GrowthPair[], onOpenModal: () => void, concept: BrandContent | null }) {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-split">
      <div className="cf-slide-split-image">
        <HouseGrowBg pairs={growthPairs} />
        <div className="cf-glass-card left" style={{ zIndex: 10, justifyContent: 'center' }}>
           <p className="cf-pn-eyebrow" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Concepto</p>
           <h3 className="cf-hero-slide-crece-title">{concept?.title || 'La Casa que Crece'}</h3>
           <p className="cf-hero-slide-crece-body">{concept?.subtitle || 'Una vivienda evolutiva que se adapta a tus necesidades.'}</p>
           <button className="cf-hero-more-btn" onClick={onOpenModal} style={{ marginTop: 'auto' }}>Ver más →</button>
        </div>
        <div className="cf-steps-footer cf-steps-footer-left" style={{ bottom: '30px', left: '40px', zIndex: 10 }}>
           <div className="cf-step-item" style={{ color: 'var(--cf-hero-olive)' }}>
             <img src="/Flecha-Roja.png" className="cf-step-arrow-img" style={{ transform: 'rotate(180deg)', marginRight: '6px' }} alt=""/>
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
function SlidePrincipal() {
  return (
    <div className="cf-hero-slide-card cf-slide-base cf-slide-solid cf-slide-solid-dark">
      <h2 className="cf-slide-title-large" style={{ marginBottom: '60px' }}>
        La casa que querés, en las<br/>condiciones que necesitás.
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
        <div className="cf-glass-card right">
           <button className="cf-hero-more-btn" onClick={onOpenModal}>Ver más →</button>
        </div>
        <div className="cf-steps-footer cf-steps-footer-right">
           <div className="cf-step-item" style={{ color: 'var(--cf-hero-olive)' }}>
             DEFINÍ TU BÚSQUEDA EN EL MENÚ
             <img src="/Flecha-Roja.png" className="cf-step-arrow-img" style={{ marginLeft: '4px' }} alt=""/>
           </div>
        </div>
      </div>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export default function HeroRow({
  brandContent = [],
  growthPairs = [],
}: HeroRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  
  // Modals state
  const [modalSection, setModalSection] = useState<HeroSection | null>(null)

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

  // Construir data para Modal Crece
  const concept = brandContent.find((b) => b.key === 'concept') ?? null
  const modalCrece: HeroSection | null = useMemo(() => {
    if (!concept) return null
    return {
      id: 'crece',
      eyebrow: 'Concepto',
      title: concept.title ?? 'La Casa que Crece',
      intro: concept.subtitle ?? undefined,
      short: [],
      long: (concept.body ?? '')
        .split(/\n{2,}/)
        .map((p, i) => ({ name: `${i + 1}.`, body: p.trim() }))
        .filter((b) => b.body.length > 0),
    } as HeroSection
  }, [concept])

  const modalFlex = useMemo(() => HERO_SECTIONS.find(s => s.id === 'flex') ?? null, [])

  const numSlides = 4

  return (
    <div className="cf-hero-row">
      <div ref={trackRef} className="cf-hero-row-track" onScroll={onScroll}>
        <div className="cf-hero-row-slide cf-hero-row-slide-section">
           <SlidePasos />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-split">
           <SlideCrece growthPairs={growthPairs} onOpenModal={() => { if(modalCrece) setModalSection(modalCrece) }} concept={concept} />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-principal">
           <SlidePrincipal />
        </div>
        <div className="cf-hero-row-slide cf-hero-row-slide-split">
           <SlideFlex onOpenModal={() => { if(modalFlex) setModalSection(modalFlex) }} />
        </div>

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
    </div>
  )
}
