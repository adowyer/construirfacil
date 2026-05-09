'use client'

/**
 * components/catalog/StickyFilters.tsx
 *
 * Pill amarilla CF sticky con los filtros del catálogo público:
 *   - Estilo (select; los estilos vienen de los modelos disponibles)
 *   - Dormitorios (pills 1 / 2 / 3 / 4+)
 *   - Superficie (pills S / SM / M / L / XL / XXL — buckets en m²)
 *   - Orden (pills: Relevante / Precio↑ / Precio↓)
 *
 * Sin opción "Todos": el filtro vacío equivale a no filtrar. El componente
 * no muestra el count de modelos para mantener la barra compacta.
 */

interface StickyFiltersProps {
  estiloFilter: string
  /** Multi-select: arrays de valores activos. Click en pill → toggle. */
  bedFilters: string[]
  sizeFilters: string[]
  sortOrder: string
  availableEstilos: string[]
  /** Sets de opciones que SÍ tienen resultados con los otros filtros activos.
   *  Si una opción no está en el set, se renderiza disabled. Las ya activas
   *  siempre quedan habilitadas (para poder destildarlas). */
  enabledBeds?: Set<string>
  enabledSizes?: Set<string>
  enabledEstilos?: Set<string>
  onEstiloChange: (v: string) => void
  onBedToggle: (v: string) => void
  onSizeToggle: (v: string) => void
  onSortChange: (v: string) => void
}

const BED_OPTIONS = ['1', '2', '3', '4+'] as const

// 4 buckets por perfil de uso, alineados a la distribución real del
// catálogo: S = cabaña/individual, M = familiar, L = familia grande,
// XL = premium. Los predicados en CatalogPage usan los mismos rangos.
const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'S', label: '–70m²' },
  { value: 'M', label: '70–120m²' },
  { value: 'L', label: '120–200m²' },
  { value: 'XL', label: '+200m²' },
]

// "+ Relevante" hoy es no-op (queda como placeholder para item 3d cuando
// agreguemos featured_rank). Precio asc/desc usa price_from interno aunque
// los precios no sean visibles al público — sigue siendo info útil para ordenar.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recommended', label: '+ Relevante' },
  { value: 'price-asc', label: 'Precio ↑' },
  { value: 'price-desc', label: 'Precio ↓' },
]

export default function StickyFilters({
  estiloFilter,
  bedFilters,
  sizeFilters,
  sortOrder,
  availableEstilos,
  enabledBeds,
  enabledSizes,
  enabledEstilos,
  onEstiloChange,
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
  const isEstiloEnabled = (v: string) =>
    !enabledEstilos || enabledEstilos.has(v) || estiloFilter === v

  return (
    <div className="cf-sticky-filters">
      <div className="cf-sticky-filters-inner">
        {/* ESTILO — select */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Estilo</span>
          <select
            className={`cf-stf-select ${estiloFilter ? 'active' : ''}`}
            value={estiloFilter}
            onChange={(e) => onEstiloChange(e.target.value)}
            aria-label="Filtrar por estilo"
          >
            <option value="">Cualquiera</option>
            {availableEstilos.map((e) => (
              <option key={e} value={e} disabled={!isEstiloEnabled(e)}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {/* DORMITORIOS — pills (multi-select) */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Dorm.</span>
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
      </div>
    </div>
  )
}
