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
  const [slideIdx, setSlideIdx] = useState(0)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  const slides: { storage_url: string; alt?: string | null }[] = (
    house.gallery_images && house.gallery_images.length
      ? house.gallery_images
      : house.cover_image
        ? [{ storage_url: house.cover_image.storage_url, alt: house.cover_image.alt_text }]
        : []
  ).map(s => ({ storage_url: s.storage_url, alt: (s as any).alt_text ?? (s as any).alt ?? house.name }))

  const total = slides.length

  useEffect(() => { if (expanded) setSlideIdx(0) }, [expanded])

  useEffect(() => {
    if (!expanded || total <= 1) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(total - 1, i + 1))
      if (e.key === 'ArrowLeft') setSlideIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, total])

  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (expanded && rowRef.current) {
      setTimeout(() => {
        const navHeight = 140
        const rowEl = rowRef.current
        if (!rowEl) return
        const rowRect = rowEl.getBoundingClientRect()
        const rowCenter = rowRect.top + window.scrollY + rowRect.height / 2
        const targetY = rowCenter - window.innerHeight / 2 - navHeight / 2
        window.scrollTo({ top: targetY, behavior: 'smooth' })
      }, 80)
    }
  }, [expanded])

  // Mouse scrub over main image → slide index
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!expanded || total <= 1) return
    const el = mainRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const newIdx = Math.min(total - 1, Math.floor(ratio * total))
    if (newIdx !== slideIdx) setSlideIdx(newIdx)
  }

  const curImg = slides[slideIdx]

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
      className={'cf-row' + (expanded ? ' cf-expanded' : '')}
      onClick={() => !expanded && onOpen()}
    >
      {/* ─── Collapsed layout ─── */}
      {!expanded && (
        <div className="cf-row-collapsed">
          <div className="cf-meta-col">
            <div className="cf-meta-name">{house.name}</div>
            <div className="cf-meta-loc">{locLine}</div>
            <div className="cf-meta-tag">{statusTag}</div>
          </div>
          <div className="cf-thumb-col">
            <div className={'cf-thumb-wrap' + (thumbLoaded ? ' cf-loaded' : '')}>
              <div className="cf-thumb-lqip" style={{ background: house.lqip_color }} />
              {house.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="cf-thumb-real"
                  src={house.cover_image.storage_url}
                  alt={house.cover_image.alt_text || house.name}
                  loading="lazy"
                  onLoad={() => setThumbLoaded(true)}
                />
              )}
            </div>
          </div>
          <div className="cf-spacer-col" />
        </div>
      )}

      {/* ─── Expanded layout (big.dk style) ─── */}
      {expanded && (
        <div className="cf-expanded-wrap" onClick={e => e.stopPropagation()}>
          <div className="cf-info-col">
            <button className="cf-close-btn" onClick={onClose} aria-label="Cerrar">×</button>

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

          <div
            ref={mainRef}
            className="cf-main-col"
            onMouseMove={handleMouseMove}
            onClick={e => { e.stopPropagation(); if (total > 1) setSlideIdx(i => (i + 1) % total) }}
          >
            {curImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={curImg.storage_url} alt={curImg.alt || house.name} />
            )}
            {total > 1 && (
              <div className="cf-main-counter">
                <strong>{String(slideIdx + 1).padStart(2, '0')}</strong>
                <span className="cf-main-counter-sep"> / </span>
                {String(total).padStart(2, '0')}
              </div>
            )}
          </div>

          <div className="cf-desc-col">
            {house.recommended_use && (
              <p className="cf-desc-text">{house.recommended_use}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

body:has(.cf-list) {
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ─── TOP NAV ─────────────────────────────────── */
.cf-topnav {
  position: sticky; top: 0; z-index: 100;
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
  padding: 4px 14px;
  font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase;
  color: #aaa; background: none;
  border: 1px solid transparent; border-radius: 100px;
  cursor: pointer; transition: color .2s, border-color .2s;
  font-family: inherit;
}
.cf-bed-btn:hover { color: #0a0a0a; border-color: #e0e0e0; }
.cf-bed-btn.cf-active { color: #0a0a0a; border-color: #0a0a0a; }

.cf-sort { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.cf-sort-label {
  font-size: 10px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: #ccc;
}
.cf-sort-btn {
  padding: 4px 12px;
  font-size: 11px; font-weight: 500; letter-spacing: .04em;
  color: #aaa; background: none;
  border: 1px solid transparent; border-radius: 100px;
  cursor: pointer; transition: color .2s, border-color .2s, background .2s;
  font-family: inherit;
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
  width: 100%; max-width: 1400px; margin: 0 auto; padding: 40px 48px 80px;
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  color: #0a0a0a; font-size: 13px; line-height: 1.5; letter-spacing: -.01em;
}
.cf-empty { padding: 80px 0; text-align: center; color: #999; font-size: 14px; }

/* ─── ROW ──────────────────────────────────────── */
.cf-row {
  position: relative;
  margin-bottom: 80px;
  cursor: pointer;
  transition: margin .5s cubic-bezier(.4,0,.2,1);
}
.cf-row:last-child { margin-bottom: 0; }
.cf-row.cf-expanded { cursor: default; margin-bottom: 40px; margin-top: 40px; }

/* ─── COLLAPSED LAYOUT (big.dk style) ──────────── */
.cf-row-collapsed {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  gap: 24px;
  min-height: 400px;
}

.cf-meta-col {
  display: flex; flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  text-align: right;
  padding-right: 20px;
}
.cf-meta-name {
  font-size: 20px; font-weight: 400;
  letter-spacing: -.02em; line-height: 1.15;
  margin-bottom: 10px;
  text-transform: uppercase;
}
.cf-meta-loc {
  font-size: 11px; font-weight: 500;
  letter-spacing: .09em; text-transform: uppercase;
  color: #888;
}
.cf-meta-tag {
  margin-top: 20px;
  font-size: 10px; font-weight: 500;
  letter-spacing: .07em; text-transform: uppercase;
  color: #bbb;
}

.cf-thumb-col {
  position: relative;
  aspect-ratio: 16/10;
  overflow: hidden;
  background: #f0f0ee;
}

.cf-spacer-col { /* right whitespace */ }

.cf-thumb-wrap { position: absolute; inset: 0; }
.cf-thumb-lqip {
  position: absolute; inset: 0; width: 100%; height: 100%;
  filter: blur(22px); transform: scale(1.1);
  transition: opacity .8s ease; z-index: 2;
}
.cf-thumb-wrap.cf-loaded .cf-thumb-lqip { opacity: 0; }
.cf-thumb-real {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; display: block; opacity: 1; z-index: 1;
  transition: transform .85s cubic-bezier(.2,.8,.2,1);
}
.cf-row:not(.cf-expanded):hover .cf-thumb-real { transform: scale(1.04); }

/* ─── EXPANDED LAYOUT (big.dk style) ───────────── */
.cf-expanded-wrap {
  display: grid;
  grid-template-columns: 22% 1fr 22%;
  min-height: 78vh;
  position: relative;
  user-select: none;
  animation: cfFadeIn .4s ease;
}
@keyframes cfFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.cf-info-col {
  display: flex; flex-direction: column; justify-content: center;
  align-items: flex-end; text-align: right;
  padding: 48px 32px;
  position: relative;
}
.cf-close-btn {
  position: absolute; top: 18px; left: 18px;
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid #e0e0e0; background: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #999; transition: border-color .2s, color .2s;
  font-family: inherit;
}
.cf-close-btn:hover { border-color: #0a0a0a; color: #0a0a0a; }

.cf-info-name {
  font-size: 24px; font-weight: 400; letter-spacing: -.02em;
  line-height: 1.15; margin-bottom: 32px; text-transform: uppercase;
}

.cf-info-meta { display: flex; flex-direction: column; gap: 18px; margin-bottom: 32px; width: 100%; }
.cf-info-row { display: flex; flex-direction: column; align-items: flex-end; }
.cf-info-label {
  font-size: 9.5px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
  color: #aaa; margin-bottom: 4px;
}
.cf-info-value {
  font-size: 13px; font-weight: 500; letter-spacing: -.01em; color: #0a0a0a;
}

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

.cf-main-col {
  position: relative; overflow: hidden;
  cursor: ew-resize;
  background: #f0f0ee;
}
.cf-main-col img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  pointer-events: none; -webkit-user-drag: none;
}
.cf-main-counter {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(255,255,255,.9); backdrop-filter: blur(6px);
  padding: 6px 14px; border-radius: 100px;
  font-size: 11px; letter-spacing: .08em; color: #999;
  pointer-events: none;
}
.cf-main-counter strong { color: #0a0a0a; font-weight: 500; }
.cf-main-counter-sep { opacity: .5; }

.cf-desc-col {
  display: flex; flex-direction: column; justify-content: flex-start;
  padding: 48px 32px;
}
.cf-desc-text {
  font-size: 14px; line-height: 1.7; color: #333;
  margin: 0;
}

/* ─── RESPONSIVE ────────────────────────────────── */
@media (max-width: 900px) {
  .cf-list { padding: 24px 20px 60px; }
  .cf-topnav { padding: 0 20px; min-height: auto; }
  .cf-nav-area { height: auto; padding: 8px 0; }
  .cf-nav { height: 40px; }
  .cf-subbar { flex-wrap: wrap; height: auto; padding: 6px 0; gap: 10px; }

  .cf-row { margin-bottom: 48px; }

  .cf-row-collapsed {
    grid-template-columns: 1fr;
    gap: 16px;
    min-height: auto;
  }
  .cf-meta-col { align-items: flex-start; text-align: left; padding-right: 0; }
  .cf-meta-tag { margin-top: 12px; }
  .cf-spacer-col { display: none; }

  .cf-expanded-wrap { grid-template-columns: 1fr; min-height: auto; }
  .cf-info-col { align-items: flex-start; text-align: left; padding: 24px 20px; }
  .cf-info-row { align-items: flex-start; }
  .cf-info-price { align-items: flex-start; }
  .cf-main-col { height: 60vh; }
  .cf-desc-col { padding: 24px 20px; }
}
@media (max-width: 580px) {
  .cf-nav-btn { padding: 0 10px; font-size: 10px; }
  .cf-constructoras-link { display: none; }
  .cf-meta-name { font-size: 22px; }
}
`
