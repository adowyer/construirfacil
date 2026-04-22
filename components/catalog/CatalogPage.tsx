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
  gallery_images?: { storage_url: string; alt_text?: string | null }[]
}

const CATEGORIES: { key: string; label: string; match: (h: House) => boolean }[] = [
  { key: 'all', label: 'Todos los modelos', match: () => true },
  { key: '1', label: '1 Dorm.', match: h => (h.min_bedrooms ?? 0) === 1 && (h.max_bedrooms ?? h.min_bedrooms ?? 0) <= 1 },
  { key: '2-3', label: '2–3 Dorm.', match: h => (h.min_bedrooms ?? 0) >= 1 && (h.max_bedrooms ?? h.min_bedrooms ?? 0) >= 2 && (h.max_bedrooms ?? h.min_bedrooms ?? 0) <= 3 },
  { key: '4+', label: '4+ Dorm.', match: h => (h.max_bedrooms ?? h.min_bedrooms ?? 0) >= 4 },
]

export default function CatalogPage({ houses }: { houses: House[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterKey, setFilterKey] = useState<string>('all')

  const activeFilter = CATEGORIES.find(c => c.key === filterKey) ?? CATEGORIES[0]
  const filtered = houses.filter(activeFilter.match)

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
          <img src="/cf_logo.png" alt="ConstruirFácil" className="cf-brand-logo" />
        </a>
        <nav className="cf-nav">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={'cf-nav-btn' + (filterKey === c.key ? ' cf-active' : '')}
              onClick={() => { setFilterKey(c.key); setExpandedId(null) }}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <div className="cf-nav-right">
          <a href="#" className="cf-constructoras-link">Constructoras</a>
        </div>
      </header>

      <main className="cf-list" style={{ width: '100%' }}>
        {filtered.map(h => (
          <Row
            key={h.variant_code}
            house={h}
            expanded={expandedId === h.variant_code}
            onOpen={() => setExpandedId(h.variant_code)}
            onClose={() => setExpandedId(null)}
          />
        ))}
        {filtered.length === 0 && (
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

  const slides: { storage_url: string; alt?: string | null }[] = (
    house.gallery_images && house.gallery_images.length
      ? house.gallery_images
      : house.cover_image
        ? [{ storage_url: house.cover_image.storage_url, alt: house.cover_image.alt_text }]
        : []
  ).map(s => ({ storage_url: s.storage_url, alt: ('alt_text' in s ? s.alt_text : s.alt) ?? house.name }))

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
        const navHeight = 72
        const rowEl = rowRef.current
        if (!rowEl) return
        const rowRect = rowEl.getBoundingClientRect()
        const rowCenter = rowRect.top + window.scrollY + rowRect.height / 2
        const targetY = rowCenter - window.innerHeight / 2 - navHeight / 2
        window.scrollTo({ top: targetY, behavior: 'smooth' })
      }, 80)
    }
  }, [expanded])

  const curImg = slides[slideIdx]
  const prevImg = total > 1 ? slides[(slideIdx - 1 + total) % total] : slides[0]

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
      <div className="cf-meta-col">
        <div className="cf-meta-icon" dangerouslySetInnerHTML={{ __html: iconSvg(house.variant_code) }} />
        <div className="cf-meta-name">{house.name}</div>
        <div className="cf-meta-loc">{locLine}</div>
        <div className="cf-meta-tag">{statusTag}</div>
      </div>

      <div className="cf-gallery-col">
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

        <div className="cf-slider-wrap">
          <div
            className="cf-sl-prev"
            onClick={e => { e.stopPropagation(); if (total > 1) setSlideIdx(i => Math.max(0, i - 1)) }}
          >
            {prevImg && <img src={prevImg.storage_url} alt="" />}
          </div>

          <div className="cf-sl-center" onClick={e => e.stopPropagation()}>
            <button className="cf-sl-close" onClick={onClose} aria-label="Cerrar">×</button>
            <div className="cf-sl-icon" dangerouslySetInnerHTML={{ __html: iconSvg(house.variant_code) }} />
            <div className="cf-sl-name">{house.name}</div>
            <div className="cf-sl-loc">{locLine}</div>
            {house.recommended_use && <div className="cf-sl-desc">{house.recommended_use}</div>}
            <div className="cf-sl-counter">
              <strong>{String(slideIdx + 1).padStart(2, '0')}</strong> / {String(Math.max(1, total)).padStart(2, '0')}
            </div>
            {total > 1 && (
              <div className="cf-sl-arrows">
                <button className="cf-sl-arr" disabled={slideIdx === 0}
                  onClick={e => { e.stopPropagation(); setSlideIdx(i => Math.max(0, i - 1)) }} aria-label="Anterior">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 3L5 8l5 5" /></svg>
                </button>
                <button className="cf-sl-arr" disabled={slideIdx === total - 1}
                  onClick={e => { e.stopPropagation(); setSlideIdx(i => Math.min(total - 1, i + 1)) }} aria-label="Siguiente">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3l5 5-5 5" /></svg>
                </button>
              </div>
            )}
            <div className="cf-sl-footer">
              {house.public_price_usd && (
                <div className="cf-sl-price">
                  <div className="cf-sl-price-label">Precio llave en mano</div>
                  <div className="cf-sl-price-value">USD {Math.round(house.public_price_usd).toLocaleString('es-AR')}</div>
                  {discountedPrice && discountedPrice !== house.public_price_usd && (
                    <div className="cf-sl-price-pozo">En pozo: USD {Math.round(discountedPrice).toLocaleString('es-AR')}</div>
                  )}
                </div>
              )}
              {house.brochure_url && (
                <a href={house.brochure_url} target="_blank" rel="noopener noreferrer"
                  className="cf-sl-brochure" onClick={e => e.stopPropagation()}>
                  Ver brochure →
                </a>
              )}
            </div>
          </div>

          <div
            className="cf-sl-main"
            onClick={e => { e.stopPropagation(); if (total > 1) setSlideIdx(i => Math.min(total - 1, i + 1)) }}
          >
            {curImg && <img src={curImg.storage_url} alt={curImg.alt || house.name} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function iconSvg(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  const s = [
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 6L42 20v22H6V20z" fill="none" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" fill="#0a0a0a"/><rect x="15" y="15" width="18" height="18" fill="#fff"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><circle cx="24" cy="24" r="7" fill="#0a0a0a"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="15" fill="#0a0a0a"/><rect x="6" y="27" width="36" height="15" fill="none" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M6 42L24 8l18 34z" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><line x1="24" y1="8" x2="24" y2="42" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><path d="M6 24h36M24 6v36" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
  ]
  return s[h % s.length]
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

body:has(.cf-list) {
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.cf-topnav {
  position: sticky; top: 0; z-index: 100;
  height: 140px; 
  display: flex; align-items: center;
  background: rgba(255,255,255,.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e8e8e8;
  padding: 0 48px;
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  color: #0a0a0a;
}
.cf-brand {
  display: flex; align-items: center;
  margin-right: 48px; flex-shrink: 0;
  text-decoration: none;
}
.cf-brand-logo {
  height: 80px; 
  width: auto;
  display: block;
}
.cf-nav { flex: 1; display: flex; align-items: stretch; height: 100%; }
.cf-nav-btn {
  display: flex; align-items: center; padding: 0 18px; height: 100%;
  font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
  color: #aaa; background: none; border: 0; cursor: pointer;
  position: relative; transition: color .2s; font-family: inherit;
}
.cf-nav-btn:hover, .cf-nav-btn.cf-active { color: #0a0a0a; }
.cf-nav-btn.cf-active::after {
  content: ''; position: absolute; bottom: -1px; left: 18px; right: 18px;
  height: 2px; background: #0a0a0a;
}
.cf-nav-right { flex-shrink: 0; display: flex; align-items: center; }
.cf-constructoras-link {
  font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
  color: #aaa; text-decoration: none; transition: color .2s;
}
.cf-constructoras-link:hover { color: #0a0a0a; }

.cf-list {
  width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 48px;
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  color: #0a0a0a; font-size: 13px; line-height: 1.5; letter-spacing: -.01em;
}
.cf-empty { padding: 80px 0; text-align: center; color: #999; font-size: 14px; }

.cf-row {
  display: flex; align-items: stretch; min-height: 440px;
  border-bottom: 1px solid #e8e8e8;
  position: relative; overflow: hidden; cursor: pointer; width: 100%;
  transition: min-height .7s cubic-bezier(.4,0,.2,1);
}
.cf-row.cf-expanded { min-height: 88vh; cursor: default; z-index: 2; }

.cf-meta-col {
  width: 37%; flex-shrink: 0;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  text-align: center; padding: 48px 40px;
  border-right: 1px solid #e8e8e8; background: #fff; overflow: hidden;
  transition: width .6s cubic-bezier(.4,0,.2,1), opacity .3s ease, padding .6s cubic-bezier(.4,0,.2,1);
}
.cf-row.cf-expanded .cf-meta-col { width: 0; opacity: 0; padding: 0; border-right: none; }
.cf-meta-icon { width: 52px; height: 52px; margin-bottom: 20px; flex-shrink: 0; }
.cf-meta-icon svg { width: 100%; height: 100%; }
.cf-meta-name { font-size: 40px; font-weight: 700; letter-spacing: -.025em; line-height: 1.15; margin-bottom: 9px; }
.cf-meta-loc { font-size: 11px; font-weight: 500; letter-spacing: .09em; text-transform: uppercase; color: #999; }
.cf-meta-tag {
  margin-top: 22px; font-size: 10px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
  color: #c8c8c8; border: 1px solid #e8e8e8; padding: 4px 12px; border-radius: 100px;
}

.cf-row:not(.cf-expanded):hover .cf-thumb-real { transform: scale(1.04); }

.cf-gallery-col { flex: 1; position: relative; overflow: hidden; background: #f0f0ee; min-width: 0; }

.cf-thumb-wrap { position: absolute; inset: 0; transition: opacity .35s ease; z-index: 1; }
.cf-row.cf-expanded .cf-thumb-wrap { opacity: 0; pointer-events: none; }
.cf-thumb-lqip {
  position: absolute; inset: 0; width: 100%; height: 100%;
  filter: blur(22px); transform: scale(1.1);
  transition: opacity .8s ease; z-index: 1;
}
.cf-thumb-wrap.cf-loaded .cf-thumb-lqip { opacity: 0; }
.cf-thumb-real {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; display: block; opacity: 1; z-index: 1;
  transition: transform .85s cubic-bezier(.2,.8,.2,1);
}
.cf-thumb-wrap.cf-loaded .cf-thumb-real { opacity: 1; }

.cf-slider-wrap {
  position: absolute; inset: 0; display: flex;
  opacity: 0; pointer-events: none;
  transition: opacity .4s ease .1s; z-index: 2; user-select: none;
}
.cf-row.cf-expanded .cf-slider-wrap { opacity: 1; pointer-events: auto; }

.cf-sl-prev {
  width: 9%; flex-shrink: 0;
  overflow: hidden; position: relative; cursor: pointer;
}
.cf-sl-prev::after {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,.55); transition: background .3s ease; z-index: 1; pointer-events: none;
}
.cf-sl-prev:hover::after { background: rgba(255,255,255,.35); }
.cf-sl-prev img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .7s cubic-bezier(.2,.8,.2,1); pointer-events: none; -webkit-user-drag: none;
}
.cf-sl-prev:hover img { transform: scale(1.03); }

.cf-sl-center {
  width: 28%; flex-shrink: 0;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  text-align: center; padding: 48px 28px 28px; background: #fff;
  border-left: 1px solid #e8e8e8; border-right: 1px solid #e8e8e8;
  position: relative; overflow-y: auto;
}
.cf-sl-close {
  position: absolute; top: 18px; right: 18px;
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid #e0e0e0; background: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #999; transition: border-color .2s, color .2s; font-family: inherit;
}
.cf-sl-close:hover { border-color: #0a0a0a; color: #0a0a0a; }
.cf-sl-icon { width: 56px; height: 56px; margin-bottom: 18px; flex-shrink: 0; }
.cf-sl-icon svg { width: 100%; height: 100%; }
.cf-sl-name { font-size: 30px; font-weight: 7400; letter-spacing: -.02em; line-height: 1.2; margin-bottom: 8px; }
.cf-sl-loc { font-size: 10.5px; font-weight: 500; letter-spacing: .09em; text-transform: uppercase; color: #aaa; margin-bottom: 22px; }
.cf-sl-desc { font-size: 12px; line-height: 1.7; color: #555; font-style: italic; margin-bottom: 22px; }
.cf-sl-counter { font-size: 11px; letter-spacing: .04em; color: #ccc; margin-bottom: 14px; }
.cf-sl-counter strong { color: #0a0a0a; font-weight: 500; }
.cf-sl-arrows { display: flex; gap: 8px; margin-bottom: 22px; }
.cf-sl-arr {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1px solid #e0e0e0; background: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #0a0a0a;
  transition: border-color .2s, background .2s, color .2s;
}
.cf-sl-arr:hover:not(:disabled) { border-color: #0a0a0a; background: #0a0a0a; color: #fff; }
.cf-sl-arr:disabled { opacity: .3; cursor: not-allowed; }
.cf-sl-footer {
  margin-top: 12px; padding-top: 22px; border-top: 1px solid #f0f0f0;
  display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%;
}
.cf-sl-price { text-align: center; }
.cf-sl-price-label { font-size: 9.5px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: #aaa; margin-bottom: 4px; }
.cf-sl-price-value { font-size: 16px; font-weight: 500; letter-spacing: -.01em; }
.cf-sl-price-pozo { font-size: 11px; color: #888; margin-top: 4px; }
.cf-sl-brochure {
  font-size: 11px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
  color: #0a0a0a; text-decoration: none; border-bottom: 1px solid #0a0a0a; padding-bottom: 2px; transition: opacity .2s;
}
.cf-sl-brochure:hover { opacity: .6; }

.cf-sl-main { flex: 1; overflow: hidden; position: relative; cursor: pointer; min-width: 0; }
.cf-sl-main img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .85s cubic-bezier(.2,.8,.2,1); pointer-events: none; -webkit-user-drag: none;
}
.cf-sl-main:hover img { transform: scale(1.03); }

@media (max-width: 900px) {
  .cf-list { padding: 0 20px; }
  .cf-topnav { padding: 0 20px; }
  .cf-row { flex-direction: column; min-height: auto; }
  .cf-row.cf-expanded { min-height: 80vh; }
  .cf-meta-col {
    width: 100%; border-right: none; border-bottom: 1px solid #e8e8e8;
    flex-direction: row; align-items: center; justify-content: flex-start;
    text-align: left; padding: 20px; gap: 16px;
  }
  .cf-row.cf-expanded .cf-meta-col { display: none; }
  .cf-meta-icon { margin-bottom: 0; }
  .cf-meta-tag { margin-top: 0; margin-left: auto; }
  .cf-gallery-col { height: 280px; }
  .cf-row.cf-expanded .cf-gallery-col { height: auto; flex: 1; }
  .cf-sl-prev { display: none; }
  .cf-sl-center { width: 50%; padding: 24px 18px; }
}
@media (max-width: 580px) {
  .cf-nav-btn { padding: 0 10px; font-size: 10px; }
  .cf-constructoras-link { display: none; }
}
`
