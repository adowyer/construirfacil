'use client'

import { useEffect, useRef, useState } from 'react'

export type House = {
  id?: string
  variant_code: string
  name: string
  area_m2: number | null
  floors?: number | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  beds?: string
  recommended_use: string | null
  construction_system: string | null
  public_price_usd: number | null
  price_pozo_usd?: number | null
  presale_discount_pct?: number | null
  brochure_url: string | null
  cover_image: { storage_url: string; alt_text?: string | null } | null
  lqip_color: string
  tags?: (string | null)[]
  status?: string
  linea?: string | null
  gallery_images?: { storage_url: string; alt_text?: string | null }[]
}

const LINES = [
  { key: 'all', label: 'Todos' },
  { key: 'BOSQUE', label: 'Bosque' },
  { key: 'ATLAS', label: 'Atlas' },
  { key: 'TERRA', label: 'Terra' },
]

const BED_FILTERS = [
  { key: 'all', label: 'Todos', match: (_h: House) => true },
  { key: '1', label: '1 Dorm.', match: (h: House) => (h.min_bedrooms ?? 0) <= 1 && (h.max_bedrooms ?? h.min_bedrooms ?? 0) <= 1 },
  { key: '2-3', label: '2–3 Dorm.', match: (h: House) => (h.max_bedrooms ?? h.min_bedrooms ?? 0) >= 2 && (h.max_bedrooms ?? h.min_bedrooms ?? 0) <= 3 },
  { key: '4+', label: '4+ Dorm.', match: (h: House) => (h.max_bedrooms ?? h.min_bedrooms ?? 0) >= 4 },
]

type SortOrder = 'none' | 'asc' | 'desc'

export default function CatalogPage({ houses = [] }: { houses: House[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lineKey, setLineKey] = useState<string>('all')
  const [bedKey, setBedKey] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')

  const byLine = lineKey === 'all'
    ? houses
    : houses.filter(h => h.linea === lineKey)

  const activeBed = BED_FILTERS.find(b => b.key === bedKey) ?? BED_FILTERS[0]
  const byBed = byLine.filter(activeBed.match)

  const sorted = [...byBed].sort((a, b) => {
    if (sortOrder === 'none') return 0
    const pa = a.public_price_usd ?? Infinity
    const pb = b.public_price_usd ?? Infinity
    return sortOrder === 'asc' ? pa - pb : pb - pa
  })

  function selectLine(key: string) {
    setLineKey(key)
    setBedKey('all')
    setExpandedId(null)
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpandedId(null)
    }
    function handleClick(e: MouseEvent) {
      if (!expandedId) return
      const target = e.target as HTMLElement
      if (!target.closest('.cf-row')) setExpandedId(null)
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('click', handleClick)
    }
  }, [expandedId])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="cf-topnav">
        <a href="#" className="cf-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cf_logo_gris.png" alt="ConstruirFácil" className="cf-brand-logo" />
        </a>

        <div className="cf-nav-area">
          <nav className="cf-nav">
            {LINES.map(l => (
              <button
                key={l.key}
                className={'cf-nav-btn' + (lineKey === l.key ? ' cf-active' : '')}
                onClick={() => selectLine(l.key)}
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="cf-subbar">
            {lineKey !== 'all' && (
              <div className="cf-bed-filters">
                {BED_FILTERS.map(b => (
                  <button
                    key={b.key}
                    className={'cf-bed-btn' + (bedKey === b.key ? ' cf-active' : '')}
                    onClick={() => { setBedKey(b.key); setExpandedId(null) }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}

            <div className="cf-sort">
              <span className="cf-sort-label">Precio</span>
              <button
                className={'cf-sort-btn' + (sortOrder === 'asc' ? ' cf-active' : '')}
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'none' : 'asc')}
              >↑ Menor</button>
              <button
                className={'cf-sort-btn' + (sortOrder === 'desc' ? ' cf-active' : '')}
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'none' : 'desc')}
              >↓ Mayor</button>
            </div>
          </div>
        </div>

        <div className="cf-nav-right">
          <a href="#" className="cf-constructoras-link">Constructoras</a>
        </div>
      </header>

      <main className="cf-list">
        {sorted.map(h => (
          <Row
            key={h.variant_code}
            house={h}
            expanded={expandedId === h.variant_code}
            onOpen={() => setExpandedId(h.variant_code)}
            onClose={() => setExpandedId(null)}
          />
        ))}
        {sorted.length === 0 && (
          <div className="cf-empty">No hay modelos que coincidan con este filtro.</div>
        )}
    </main>
    </>
  )
}

function Row({
  house, expanded, onOpen, onClose,
}: {
  house: House; expanded: boolean; onOpen: () => void; onClose: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const slides: { storage_url: string; alt?: string | null }[] = (
    house.gallery_images && house.gallery_images.length
      ? house.gallery_images
      : house.cover_image
        ? [{ storage_url: house.cover_image.storage_url, alt: house.cover_image.alt_text }]
        : []
  ).map(s => ({ storage_url: s.storage_url, alt: (s as any).alt_text ?? (s as any).alt ?? house.name }))

  // --- 1. Pure Zoom-Out Intercept (BIG.dk standard) ---
  useEffect(() => {
    if (!expanded) {
      document.body.style.overflowY = 'auto'
      if (rowRef.current) rowRef.current.style.removeProperty('--expand-progress')
      return
    }

    let rafId: number
    let isLooping = true
    let virtualScroll = 0

    // Spring physics states
    const targetProgress = { current: 1.0 }
    const currentProgress = { current: 0.45 } // Starts zoomed out to actively bounce open!
    const velocity = { current: 0.0 }

    const loop = () => {
      if (!isLooping) return
      
      const stiffness = 0.08  
      const damping = 0.70    
      
      const pull = (targetProgress.current - currentProgress.current) * stiffness
      velocity.current += pull
      velocity.current *= damping
      currentProgress.current += velocity.current

      // Lock bounds & Close execution
      if (targetProgress.current <= 0 && currentProgress.current <= 0.02 && Math.abs(velocity.current) < 0.005) {
        document.body.style.overflowY = 'auto'
        onClose()
        isLooping = false
        return
      }

      if (rowRef.current) {
        rowRef.current.style.setProperty('--expand-progress', Math.max(0, currentProgress.current).toFixed(4))
      }

      rafId = requestAnimationFrame(loop)
    }

    // Start loop immediately so it bounces open right away without jump!
    rafId = requestAnimationFrame(loop)

    const handleWheel = (e: WheelEvent) => {
      // If primarily vertical, capture it as "zoom out"
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) + 5) {
        e.preventDefault() 
        virtualScroll += e.deltaY
        if (virtualScroll < 0) virtualScroll = 0 // Don't allow scrolling 'up' into negative
        targetProgress.current = Math.max(0, 1.0 - (virtualScroll / 180))
      }
    }

    // Wait 850ms for the auto-smooth scroll to finish, THEN lock body and listen
    const timer = setTimeout(() => {
      document.body.style.overflowY = 'hidden'
      window.addEventListener('wheel', handleWheel, { passive: false })
    }, 850)

    return () => {
      isLooping = false
      document.body.style.overflowY = 'auto'
      clearTimeout(timer)
      window.removeEventListener('wheel', handleWheel)
      cancelAnimationFrame(rafId)
    }
  }, [expanded, onClose])

  // --- 2. Click and Drag to Pan Horizontal (like BIG.dk) ---
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startD, setStartD] = useState(0)

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!expanded) return
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    setStartX(clientX)
    setStartD(window.scrollX)
  }
  const onDragEnd = () => setIsDragging(false)
  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !expanded) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const walk = (clientX - startX) * 1.5 // Panning speed weight
    window.scrollTo({ left: startD - walk, top: window.scrollY, behavior: 'instant' })
  }

  // Center row horizontally aligned with the nav organically
  useEffect(() => {
    if (expanded && rowRef.current) {
      setTimeout(() => {
        const navHeight = 140
        const rowEl = rowRef.current
        if (!rowEl) return
        const rowRect = rowEl.getBoundingClientRect()
        const targetY = rowRect.top + window.scrollY - navHeight
        window.scrollTo({ top: targetY, behavior: 'smooth' })
      }, 150)
    }
  }, [expanded])

  const locLine = [
    house.area_m2 ? `${house.area_m2} m²` : null,
    house.beds ? `${house.beds} DORM.` : null,
  ].filter(Boolean).join(' · ')

  const statusTag = house.construction_system || 'HAUSIND'
  const discountedPrice = house.price_pozo_usd ?? (
    house.public_price_usd && house.presale_discount_pct
      ? house.public_price_usd * (1 - house.presale_discount_pct / 100)
      : null
  )

  return (
    <div
      ref={rowRef}
      className={'cf-row' + (expanded ? ' cf-expanded' : '') + (isDragging ? ' cf-dragging' : '')}
      onClick={() => !expanded && onOpen()}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      onMouseMove={onDragMove}
      onTouchStart={onDragStart}
      onTouchEnd={onDragEnd}
      onTouchMove={onDragMove}
    >
      {/* ── COL 1: Meta (Left) ── */}
      <div className="cf-col-left">
        {!expanded ? (
          <div className="cf-meta-col">
            <div className="cf-meta-name">{house.name}</div>
            <div className="cf-meta-loc">{locLine}</div>
            <div className="cf-meta-tag">{statusTag}</div>
          </div>
        ) : (
          <div className="cf-info-col" onClick={e => e.stopPropagation()}>
            <button
              className="cf-close-btn"
              onClick={e => { e.stopPropagation(); onClose() }}
              aria-label="Cerrar"
            >×</button>

            <div className="cf-info-name">{house.name}</div>

            <div className="cf-info-meta">
              {house.linea && (
                <div className="cf-info-row">
                  <div className="cf-info-label">Línea</div>
                  <div className="cf-info-value">{house.linea}</div>
                </div>
              )}
              {house.area_m2 && (
                <div className="cf-info-row">
                  <div className="cf-info-label">Superficie</div>
                  <div className="cf-info-value">{house.area_m2} m²</div>
                </div>
              )}
              {house.beds && (
                <div className="cf-info-row">
                  <div className="cf-info-label">Dormitorios</div>
                  <div className="cf-info-value">{house.beds}</div>
                </div>
              )}
              {house.construction_system && (
                <div className="cf-info-row">
                  <div className="cf-info-label">Sistema</div>
                  <div className="cf-info-value">{house.construction_system}</div>
                </div>
              )}
              {house.floors && (
                <div className="cf-info-row">
                  <div className="cf-info-label">Plantas</div>
                  <div className="cf-info-value">{house.floors}</div>
                </div>
              )}
            </div>

            {house.public_price_usd && (
              <div className="cf-info-price">
                <div className="cf-info-label">Precio llave en mano</div>
                <div className="cf-info-price-value">USD {Math.round(house.public_price_usd).toLocaleString('es-AR')}</div>
                {discountedPrice && discountedPrice !== house.public_price_usd && (
                  <div className="cf-info-price-pozo">En pozo: USD {Math.round(discountedPrice).toLocaleString('es-AR')}</div>
                )}
              </div>
            )}

            <a
              href={`/models/${house.variant_code}`}
              className="cf-info-more"
              onClick={e => e.stopPropagation()}
            >
              Ver más →
            </a>
          </div>
        )}
      </div>

      {/* ── COL 2: Gallery (Center Horizontal Scroll) ── */}
      <div className="cf-col-center cf-gallery" ref={scrollRef}>
        {slides.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slides[0].storage_url} alt={slides[0].alt || house.name} className="cf-img-item" />
        )}
        {expanded && slides.slice(1).map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={img.storage_url} alt={img.alt || house.name} className="cf-img-item" />
        ))}
      </div>

      {/* ── COL 3: Description (Right) ── */}
      <div className="cf-col-right" onClick={e => expanded && e.stopPropagation()}>
        {expanded && house.recommended_use && (
          <div className="cf-desc-col">
            <p className="cf-desc-text">{house.recommended_use}</p>
          </div>
        )}
      </div>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

body:has(.cf-list) {
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: auto !important; /* ALLOW HORIZONTAL SCROLL FOR EXPANDED ITEM */
}

/* smooth easing shared by clean elements */
.cf-row,
.cf-col-left,
.cf-col-center,
.cf-col-right,
.cf-info-col,
.cf-desc-col,
.cf-img-item {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ─── TOP NAV ─────────────────────────────────── */
.cf-topnav {
  position: sticky; top: 0; left: 0; z-index: 100;
  width: 100vw !important; /* Ensure it stays viewport width when body stretches horizontally */
  display: flex; align-items: center;
  background: rgba(255,255,255,.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e8e8e8;
  padding: 0 48px;
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  color: #0a0a0a;
  min-height: 140px;
  flex-wrap: wrap;
}
.cf-brand { display: flex; align-items: center; margin-right: 48px; flex-shrink: 0; text-decoration: none; }
.cf-brand-logo { height: 85px; width: auto; display: block; }

.cf-nav-area { flex: 1; display: flex; flex-direction: column; justify-content: center; height: 140px; }
.cf-nav { display: flex; align-items: center; height: 52px; }
.cf-nav-btn {
  display: flex; align-items: center; padding: 0 18px; height: 100%;
  font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
  color: #aaa; background: none; border: 0; cursor: pointer;
  position: relative; transition: color .2s; font-family: inherit;
}
.cf-nav-btn:hover, .cf-nav-btn.cf-active { color: #0a0a0a; }
.cf-nav-btn.cf-active::after {
  content: ''; position: absolute; bottom: 0; left: 18px; right: 18px;
  height: 2px; background: #0a0a0a;
}

.cf-subbar { display: flex; align-items: center; height: 40px; border-top: 1px solid #f0f0f0; gap: 24px; }
.cf-bed-filters { display: flex; align-items: center; gap: 4px; }
.cf-bed-btn {
  padding: 4px 14px; font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase;
  color: #aaa; background: none; border: 1px solid transparent; border-radius: 100px;
  cursor: pointer; transition: color .2s, border-color .2s; font-family: inherit;
}
.cf-bed-btn:hover { color: #0a0a0a; border-color: #e0e0e0; }
.cf-bed-btn.cf-active { color: #0a0a0a; border-color: #0a0a0a; }

.cf-sort { display: flex; align-items: center; gap: 6px; margin-left: auto; padding-right: 24px; }
.cf-sort-label { font-size: 10px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: #ccc; }
.cf-sort-btn {
  padding: 4px 12px; font-size: 11px; font-weight: 500; letter-spacing: .04em; color: #aaa; background: none;
  border: 1px solid transparent; border-radius: 100px; cursor: pointer; transition: color .2s, border-color .2s, background .2s; font-family: inherit;
}
.cf-sort-btn:hover { color: #0a0a0a; border-color: #e0e0e0; }
.cf-sort-btn.cf-active { color: #fff; background: #0a0a0a; border-color: #0a0a0a; }
.cf-nav-right { flex-shrink: 0; display: flex; align-items: center; margin-left: 24px; }
.cf-constructoras-link {
  font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
  color: #aaa; text-decoration: none; transition: color .2s;
}
.cf-constructoras-link:hover { color: #0a0a0a; }

/* ─── LIST ─────────────────────────────────────── */
.cf-list {
  width: 100%; margin: 0; padding: 40px 0 80px;
  /* Removed max-width here so expanded rows can stretch infinitely horizontally */
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  color: #0a0a0a; font-size: 13px; line-height: 1.5; letter-spacing: -.01em;
}
.cf-empty { padding: 80px 0; text-align: center; color: #999; font-size: 14px; }

/* ─── ROW LAYOUT (BIG PATTERN) ──────────────────── */
.cf-row {
  display: flex;
  max-width: 1540px; /* Constrain collapsed rows */
  margin: 0 auto;
  padding: 0 48px;
  height: 440px;
  border-bottom: 1px solid #e8e8e8;
  cursor: pointer;
  overflow: hidden;
  /* Extreme cinematic 2.5s transitions for opening / closing */
  transition: height 2.5s cubic-bezier(0.16, 1, 0.3, 1), 
              max-width 2.5s cubic-bezier(0.16, 1, 0.3, 1), 
              padding 2.5s cubic-bezier(0.16, 1, 0.3, 1), 
              background 2.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cf-row.cf-expanded {
  height: 85vh;
  max-width: none;
  width: max-content; /* This creates the huge horizontal canvas */
  margin: 0;
  /* Retain left padding dynamically proportional to the container so it aligns */
  padding-left: max(48px, calc(50vw - 770px));
  padding-right: 48px;
  cursor: grab;
  background: #fdfdfd;
  /* Mapped directly to scroll via JS Physics Loop (60fps Spring) */
  transform-origin: center center;
  transform: scale(calc(0.75 + 0.25 * var(--expand-progress, 1)));
}
.cf-row.cf-dragging {
  cursor: grabbing;
}

/* ─── LEFT: Meta ─── */
.cf-col-left {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 48px 48px 48px 0;
  width: 380px;       /* Fixed left column */
  flex-shrink: 0;
  transition: width 2.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cf-row.cf-expanded .cf-col-left {
  width: 350px;
}
.cf-meta-col {
  display: flex; flex-direction: column; align-items: flex-end; text-align: right;
  animation: cfFadeIn 0.5s ease forwards;
}
.cf-meta-name { font-size: 22px; font-weight: 400; letter-spacing: -.02em; margin-bottom: 8px; color: #0a0a0a; }
.cf-meta-loc { font-size: 11px; font-weight: 500; letter-spacing: .09em; text-transform: uppercase; color: #888; }
.cf-meta-tag { margin-top: 16px; font-size: 10px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase; color: #bbb; }

.cf-info-col {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; justify-content: center;
  align-items: flex-end; text-align: right;
  padding: 48px 48px 48px 0;
  animation: cfSlideFade 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.cf-close-btn {
  position: absolute; top: 32px; left: 0px;
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid #e0e0e0; background: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #999;
  transition: border-color .2s, color .2s;
  font-family: inherit;
}
.cf-close-btn:hover { border-color: #0a0a0a; color: #0a0a0a; }

.cf-info-name {
  font-size: 30px; font-weight: 400; letter-spacing: -.02em;
  line-height: 1.15; margin-bottom: 32px; color: #0a0a0a;
}
.cf-info-meta { display: flex; flex-direction: column; gap: 18px; margin-bottom: 32px; width: 100%; }
.cf-info-row { display: flex; flex-direction: column; align-items: flex-end; }
.cf-info-label { font-size: 9.5px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: #aaa; margin-bottom: 4px; }
.cf-info-value { font-size: 13px; font-weight: 500; letter-spacing: -.01em; color: #0a0a0a; }

.cf-info-price { width: 100%; margin-bottom: 22px; display: flex; flex-direction: column; align-items: flex-end; }
.cf-info-price-value { font-size: 18px; font-weight: 500; letter-spacing: -.01em; color: #0a0a0a; }
.cf-info-price-pozo { font-size: 11px; color: #888; margin-top: 4px; }

.cf-info-more {
  font-size: 11px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
  color: #0a0a0a; text-decoration: none;
  border-bottom: 1px solid #0a0a0a; padding-bottom: 2px;
  transition: opacity .2s;
}
.cf-info-more:hover { opacity: .6; }

/* ─── CENTER: Horizontal Gallery ─── */
.cf-col-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center; /* Always keeps the image optically centered to avoid layout jumps */
  flex: 1; /* Stretch to fill space when collapsed */
  gap: 16px;
  padding: 40px 0;
}
.cf-row.cf-expanded .cf-col-center {
  flex: 0 0 auto;
  width: max-content; /* Expands to natural bounds of all photos */
  padding: 0;
}

.cf-img-item {
  height: auto;
  max-height: 100%;
  width: 100%; 
  max-width: 650px; /* Constrains image when collapsed, creating whitespace */
  aspect-ratio: 16/10;
  object-fit: cover;
  flex-shrink: 0;
  pointer-events: none; /* Prevents dragging the img element natively */
  /* Intense 2.5s cinematic transformation */
  transition: transform 2.5s cubic-bezier(0.16, 1, 0.3, 1), max-width 2.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cf-row:not(.cf-expanded):hover .cf-img-item {
  transform: scale(1.025);
}
.cf-row.cf-expanded .cf-img-item {
  height: auto;
  max-height: 65vh; /* Massive cinematic top/bottom padding to center perfectly */
  width: auto;
  max-width: none; 
  aspect-ratio: auto;
}

/* ─── RIGHT: Description ─── */
.cf-col-right {
  position: relative;
  display: flex;
  align-items: center;
  padding: 48px 0 48px 64px;
  width: 0;           /* Hidden when collapsed */
  opacity: 0;
  overflow: hidden;
  flex-shrink: 0;
  transition: width 2.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 2.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cf-row.cf-expanded .cf-col-right {
  width: 450px;
  opacity: 1;
}
.cf-desc-col {
  animation: cfSlideFade 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.cf-desc-text {
  font-size: 13px; line-height: 1.75; color: #555; margin: 0;
}

/* ─── UTILS ─── */
@keyframes cfSlideFade {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes cfFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ─── RESPONSIVE ────────────────────────────────── */
@media (max-width: 900px) {
  .cf-list { padding: 24px 0 60px; }
  .cf-topnav { padding: 0 20px; min-height: auto; }
  .cf-nav-area { height: auto; padding: 8px 0; }
  .cf-nav { height: 40px; }
  .cf-subbar { flex-wrap: wrap; height: auto; padding: 6px 0; gap: 10px; }

  .cf-row { 
    flex-direction: column;
    height: auto;
    min-height: 480px;
    padding: 0 20px;
    margin-bottom: 56px;
    border-bottom: none;
  }
  .cf-row.cf-expanded { 
    flex-direction: column;
    height: auto;
    min-height: 80vh;
    padding: 0 20px;
    width: 100vw; /* limit for mobile */
  }
  
  .cf-col-left {
    width: 100%;
    padding: 0 0 24px 0;
    align-items: flex-start;
  }
  .cf-row.cf-expanded .cf-col-left {
    width: 100%;
  }
  .cf-meta-col, .cf-info-col {
    align-items: flex-start; text-align: left; padding: 0; position: static;
  }
  .cf-info-col { margin-top: 16px; }
  .cf-info-row, .cf-info-price { align-items: flex-start; }
  .cf-close-btn { position: absolute; right: 0; left: auto; top: -8px; }

  .cf-col-center {
    width: 100%;
    padding: 0;
  }
  .cf-img-item {
    max-width: none;
    aspect-ratio: 16/10;
  }
  .cf-row.cf-expanded .cf-img-item {
    width: 100%;
    height: auto;
  }
  
  .cf-col-right {
    width: 100%;
    padding: 24px 0;
  }
  .cf-row.cf-expanded .cf-col-right {
    width: 100%;
  }
}
@media (max-width: 580px) {
  .cf-nav-btn { padding: 0 10px; font-size: 10px; }
  .cf-constructoras-link { display: none; }
  .cf-meta-name { font-size: 22px; }
}`

