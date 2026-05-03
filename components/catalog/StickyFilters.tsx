'use client'

/**
 * components/catalog/StickyFilters.tsx
 *
 * Barra de filtros en color CF amarillo, position: sticky debajo del
 * SiteHeader. Cuando el usuario scrollea más allá del HeroRow, queda pegada
 * al top con efecto glass blur.
 *
 * Pills horizontales: Línea / Dormitorios / Tamaño + sort por precio.
 */

interface StickyFiltersProps {
  lineFilter: string
  bedFilter: string
  sizeFilter: string
  sortOrder: string
  resultCount: number
  onLineChange: (v: string) => void
  onBedChange: (v: string) => void
  onSizeChange: (v: string) => void
  onSortChange: (v: string) => void
}

const LINE_OPTIONS = ['ALL', 'ATLAS', 'BOSQUE', 'TERRA']
const LINE_LABELS: Record<string, string> = {
  ALL: 'Todas',
  ATLAS: 'Atlas',
  BOSQUE: 'Bosque',
  TERRA: 'Terra',
}

const BED_OPTIONS = ['ALL', '1-2', '3', '4+']
const BED_LABELS: Record<string, string> = {
  ALL: 'todos',
  '1-2': '1-2',
  '3': '3',
  '4+': '4+',
}

const SIZE_OPTIONS = ['ALL', 'S', 'M', 'L']
const SIZE_LABELS: Record<string, string> = {
  ALL: 'todos',
  S: '–80m²',
  M: '80–160m²',
  L: '+160m²',
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recommended', label: 'Sugeridos' },
  { value: 'price-asc', label: 'Precio ↑' },
  { value: 'price-desc', label: 'Precio ↓' },
]

export default function StickyFilters({
  lineFilter,
  bedFilter,
  sizeFilter,
  sortOrder,
  resultCount,
  onLineChange,
  onBedChange,
  onSizeChange,
  onSortChange,
}: StickyFiltersProps) {
  return (
    <div className="cf-sticky-filters">
      <div className="cf-sticky-filters-inner">
        {/* LÍNEA */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Línea</span>
          {LINE_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`cf-stf-pill ${lineFilter === v ? 'active' : ''}`}
              onClick={() => onLineChange(v)}
            >
              {LINE_LABELS[v]}
            </button>
          ))}
        </div>

        {/* DORMITORIOS */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Dorm.</span>
          {BED_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`cf-stf-pill ${bedFilter === v ? 'active' : ''}`}
              onClick={() => onBedChange(v)}
            >
              {BED_LABELS[v]}
            </button>
          ))}
        </div>

        {/* TAMAÑO */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Tamaño</span>
          {SIZE_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`cf-stf-pill ${sizeFilter === v ? 'active' : ''}`}
              onClick={() => onSizeChange(v)}
            >
              {SIZE_LABELS[v]}
            </button>
          ))}
        </div>

        {/* SPACER */}
        <div className="cf-stf-spacer" />

        {/* COUNT */}
        <span className="cf-stf-count">
          {resultCount} {resultCount === 1 ? 'modelo' : 'modelos'}
        </span>

        {/* ORDEN */}
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
      </div>
    </div>
  )
}
