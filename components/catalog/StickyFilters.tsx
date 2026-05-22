'use client'

/**
 * components/catalog/StickyFilters.tsx
 *
 * Pill roja CF sticky con los filtros del catálogo público:
 *   - "Elegí tu casa" — texto intro de la barra
 *   - Dormitorios (pills 1 / 2 / 3 / 4+)
 *   - Superficie (pills S / SM / M / L — 4 buckets en m²)
 *   - Orden (pills: Relevante / Precio↑ / Precio↓)
 *
 * Sin opción "Todos": el filtro vacío equivale a no filtrar. El componente
 * no muestra el count de modelos para mantener la barra compacta.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface StickyFiltersProps {
  /** Multi-select: arrays de valores activos. Click en pill → toggle. */
  bedFilters: string[]
  sizeFilters: string[]
  sortOrder: string
  /** Sets de opciones que SÍ tienen resultados con los otros filtros activos.
   *  Si una opción no está en el set, se renderiza disabled. Las ya activas
   *  siempre quedan habilitadas (para poder destildarlas). */
  enabledBeds?: Set<string>
  enabledSizes?: Set<string>
  onBedToggle: (v: string) => void
  onSizeToggle: (v: string) => void
  onSortChange: (v: string) => void
}

const BED_OPTIONS = ['1', '2', '3', '4+'] as const

// 4 buckets por perfil de uso, alineados a la distribución real del
// catálogo: S = cabaña/individual, SM = pareja/familia chica, M = familiar,
// L = familia grande / premium (+120). Los predicados en CatalogPage usan
// los mismos rangos.
const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'S', label: '–70m²' },
  { value: 'SM', label: '70–90m²' },
  { value: 'M', label: '90–120m²' },
  { value: 'L', label: '+120m²' },
]

// "+ Relevante" ordena por house_catalog.featured_rank asc nulls last
// (admin lo setea por modelo; ver CatalogPage sortOrder). Precio asc/desc
// usa price_from interno aunque los precios no sean visibles al público.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recommended', label: '+ Relevante' },
  { value: 'price-asc', label: 'Precio ↑' },
  { value: 'price-desc', label: 'Precio ↓' },
]

export default function StickyFilters({
  bedFilters,
  sizeFilters,
  sortOrder,
  enabledBeds,
  enabledSizes,
  onBedToggle,
  onSizeToggle,
  onSortChange,
}: StickyFiltersProps) {
  // Una opción está habilitada si:
  //   - no le pasamos sets de "enabled" (modo retro-compat / sin filtros activos), o
  //   - está en el set, o
  //   - es una opción ya activa (para poder destildarla).
  const isBedEnabled = (v: string) =>
    !enabledBeds || enabledBeds.has(v) || bedFilters.includes(v)
  const isSizeEnabled = (v: string) =>
    !enabledSizes || enabledSizes.has(v) || sizeFilters.includes(v)

  // Mobile: la barra se reduce a una hamburguesa que abre los filtros en
  // un overlay translúcido desde arriba. Portal a <body> porque el shell
  // del catálogo usa transform y atraparía un position:fixed.
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── Sticky por scroll ───────────────────────────────────────────────
  // La barra NO puede usar `position: sticky`: el catálogo vive dentro del
  // acordeón `.cf-section-shell-inner` con `overflow: hidden`, que crea un
  // scroll container y mata el sticky. En su lugar: un sentinel de 0px en
  // flujo marca la posición natural; cuando su top cruza 16px fijamos la
  // barra (`position: fixed`, escapa el overflow) y un spacer del alto de
  // la barra evita que el catálogo pegue un salto.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const barHRef = useRef(0)
  const [stuck, setStuck] = useState(false)
  const [barH, setBarH] = useState(0)

  useEffect(() => {
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0
      barHRef.current = h
      setBarH(h)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const update = () => {
      const sentinelTop = sentinel.getBoundingClientRect().top
      const parent = sentinel.parentElement
      const parentBottom = parent
        ? parent.getBoundingClientRect().bottom
        : Number.POSITIVE_INFINITY
      // Fija cuando pasamos el sentinel Y todavía queda catálogo abajo; al
      // llegar al final del catálogo la soltamos (como haría sticky).
      setStuck(sentinelTop <= 16 && parentBottom - 16 > barHRef.current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const activeCount =
    bedFilters.length +
    sizeFilters.length +
    (sortOrder && sortOrder !== 'recommended' ? 1 : 0)

  const groups = (
    <>
      {/* ELEGÍ — intro de la barra (reemplaza el viejo filtro de Estilo) */}
        <span className="cf-stf-elegi">Elegí tu casa</span>

        {/* DORMITORIOS — pills (multi-select) */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Dormitorios</span>
          {BED_OPTIONS.map((v) => {
            const enabled = isBedEnabled(v)
            const active = bedFilters.includes(v)
            return (
              <button
                key={v}
                type="button"
                className={`cf-stf-pill ${active ? 'active' : ''} ${
                  enabled ? '' : 'cf-stf-pill-disabled'
                }`}
                disabled={!enabled}
                onClick={() => onBedToggle(v)}
              >
                {v}
              </button>
            )
          })}
        </div>

        {/* SUPERFICIE — pills (multi-select) */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Superficie</span>
          {SIZE_OPTIONS.map((s) => {
            const enabled = isSizeEnabled(s.value)
            const active = sizeFilters.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                className={`cf-stf-pill ${active ? 'active' : ''} ${
                  enabled ? '' : 'cf-stf-pill-disabled'
                }`}
                disabled={!enabled}
                onClick={() => onSizeToggle(s.value)}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <div className="cf-stf-spacer" />

        {/* ORDEN — pills */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Orden</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`cf-stf-pill cf-stf-pill-dark ${sortOrder === s.value ? 'active' : ''}`}
              onClick={() => onSortChange(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
    </>
  )

  return (
    <>
      {/* Sentinel en flujo: referencia fija para detectar el scroll. */}
      <div
        ref={sentinelRef}
        className="cf-sticky-filters-sentinel"
        aria-hidden="true"
      />
      {/* Spacer: cuando la barra se fija sale del flujo; este div ocupa su
          lugar para que el catálogo no salte hacia arriba. */}
      {stuck && (
        <div
          className="cf-sticky-filters-spacer"
          style={{ height: barH }}
          aria-hidden="true"
        />
      )}
      <div
        ref={barRef}
        className={`cf-sticky-filters${open ? ' is-open' : ''}${
          stuck ? ' is-stuck' : ''
        }`}
      >
      {/* Mobile: trigger hamburguesa (oculto en desktop por CSS). */}
      <button
        type="button"
        className="cf-stf-hamburger"
        aria-label="Abrir filtros"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" className="cf-stf-hamburger-icon">
          ☰
        </span>
        Filtros
        {activeCount > 0 && (
          <span className="cf-stf-hamburger-badge">{activeCount}</span>
        )}
      </button>

      {/* Desktop: barra inline de siempre (oculta en mobile por CSS). */}
      <div className="cf-sticky-filters-inner">{groups}</div>

      {/* Mobile: overlay translúcido desde arriba. Portal a <body> para
          escapar el transform del shell del catálogo. */}
      {mounted &&
        open &&
        createPortal(
          <div
            className="cf-stf-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            onClick={() => setOpen(false)}
          >
            <div
              className="cf-stf-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="cf-stf-close"
                aria-label="Cerrar filtros"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
              <div className="cf-sticky-filters-inner cf-sticky-filters-inner--sheet">
                {groups}
              </div>
            </div>
          </div>,
          document.body,
        )}
      </div>
    </>
  )
}
