'use client'

/**
 * components/catalog/StickyFilters.tsx
 *
 * Pill roja CF sticky con los filtros del catálogo público:
 *   - "Elegí" — intro de la barra
 *   - Dormitorios (pills 1 / 2 / 3 / 4+)
 *   - Superficie (pills S/M/L/XL — 4 buckets en m²)
 *   - Precio (pills, 4 bandas USD)
 *   - Provincia (select — 24 jurisdicciones; aplica reglas zonales si las hay)
 *   - Ofertas (pill toggle, único)
 *
 * Sin "Todos": el filtro vacío equivale a no filtrar.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProvinciaRow } from '@/lib/supabase/queries/zones'

interface StickyFiltersProps {
  /** Multi-select: arrays de valores activos. Click en pill → toggle. */
  bedFilters: string[]
  sizeFilters: string[]
  priceFilter: string | null
  provinciaId: string | null
  onlyOffers: boolean
  /** Contexto Lote del usuario (diferenciador del producto). Sincronizado
   *  bidireccional con los CTAs del hero banner — cualquiera de los dos
   *  cambia el mismo state. Select compacto (labels cortos) para no
   *  inflar la barra. */
  tieneLote: 'si' | 'no' | null
  /** Sets de opciones que SÍ tienen resultados con los otros filtros activos. */
  enabledBeds?: Set<string>
  enabledSizes?: Set<string>
  enabledPrices?: Set<string>
  provincias: ProvinciaRow[]
  onBedToggle: (v: string) => void
  onSizeToggle: (v: string) => void
  onPriceChange: (v: string | null) => void
  onProvinciaChange: (id: string | null) => void
  onOffersToggle: () => void
  onTieneLoteChange: (v: 'si' | 'no' | null) => void
}

const BED_OPTIONS = ['1', '2', '3', '4+'] as const

// 4 buckets, alineados a la distribución real. Los predicados en CatalogPage
// usan los mismos rangos.
const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'S', label: '–70m²' },
  { value: 'M', label: '70–100m²' },
  { value: 'L', label: '100–150m²' },
  { value: 'XL', label: '+150m²' },
]

// 4 bandas de precio (USD lista). Cubren la distribución real:
//   ~30% catálogo < 100k, ~30% en 100-150k, ~30% en 150-300k, ~10% > 300k.
// Labels en "mil" (no "k") — la mayoría del público no lee abreviaturas anglo.
const PRICE_OPTIONS: { value: string; label: string }[] = [
  { value: 'lt100', label: '-100mil' },
  { value: '100-150', label: '100-150mil' },
  { value: '150-300', label: '150-300mil' },
  { value: 'gt300', label: '+300mil' },
]

export default function StickyFilters({
  bedFilters,
  sizeFilters,
  priceFilter,
  provinciaId,
  onlyOffers,
  tieneLote,
  enabledBeds,
  enabledSizes,
  enabledPrices,
  provincias,
  onBedToggle,
  onSizeToggle,
  onPriceChange,
  onProvinciaChange,
  onOffersToggle,
  onTieneLoteChange,
}: StickyFiltersProps) {
  const isBedEnabled = (v: string) =>
    !enabledBeds || enabledBeds.has(v) || bedFilters.includes(v)
  const isSizeEnabled = (v: string) =>
    !enabledSizes || enabledSizes.has(v) || sizeFilters.includes(v)
  const isPriceEnabled = (v: string) =>
    !enabledPrices || enabledPrices.has(v) || priceFilter === v

  // Mobile: la barra se reduce a una hamburguesa que abre los filtros en
  // un overlay translúcido desde arriba. Portal a <body> porque el shell
  // del catálogo usa transform y atraparía un position:fixed.
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── Sticky por scroll ───────────────────────────────────────────────
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
    (priceFilter ? 1 : 0) +
    (provinciaId ? 1 : 0) +
    (onlyOffers ? 1 : 0) +
    (tieneLote ? 1 : 0)

  const groups = (
    <>
      {/* ELEGÍ — intro de la barra */}
      <span className="cf-stf-elegi">Elegí</span>

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

      {/* PRECIO removido: si el cliente necesita financiación y aún no
          sabe cuánto le aprueba el banco, filtrar por rango de precio
          absoluto choca con la propuesta y agrega friction sin valor.
          La lógica de filtrado (skuMatchesPrice) queda inactiva porque
          el state siempre es null; cleanup futuro. */}

      {/* UBICACIÓN — select de provincia */}
      <div className="cf-stf-group">
        <span className="cf-stf-lbl">Zona</span>
        <select
          className={`cf-stf-select ${provinciaId ? 'active' : ''}`}
          value={provinciaId ?? ''}
          onChange={(e) => onProvinciaChange(e.target.value || null)}
        >
          <option value="">Todo el país</option>
          {provincias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* TERRENO — pregunta directa al cliente (en AR todos dicen "terreno",
          no "lote"). El producto sigue siendo "Casa + Lote" en los banners,
          pero al cliente se le pregunta en su voz. Sincronizado bidireccional
          con los CTAs del hero banner. */}
      <div className="cf-stf-group">
        <span className="cf-stf-lbl">¿Tenés terreno?</span>
        <select
          className={`cf-stf-select ${tieneLote ? 'active' : ''}`}
          value={tieneLote ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onTieneLoteChange(v === 'si' || v === 'no' ? v : null)
          }}
          style={{ minWidth: 0 }}
        >
          <option value="">—</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </div>

      {/* VER — CTA al final. Scroll smooth a la grilla del listado: si el
          usuario está arriba, baja al primer modelo; si está en el medio,
          el scrollIntoView del top de la grilla lo sube al inicio. */}
      <button
        type="button"
        className="cf-stf-pill cf-stf-pill-ver"
        onClick={() => {
          const grid = document.querySelector('.cf-grid')
          if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      >
        Ver →
      </button>
    </>
  )

  return (
    <>
      <div
        ref={sentinelRef}
        className="cf-sticky-filters-sentinel"
        aria-hidden="true"
      />
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

        <div className="cf-sticky-filters-inner">{groups}</div>

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
