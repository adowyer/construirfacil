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
  bedFilter: string
  sizeFilter: string
  sortOrder: string
  availableEstilos: string[]
  /** Sets de opciones que SÍ tienen resultados con los otros filtros activos.
   *  Si una opción no está en el set, se renderiza disabled. La opción ya
   *  activa siempre queda habilitada (para poder destildarla). */
  enabledBeds?: Set<string>
  enabledSizes?: Set<string>
  enabledEstilos?: Set<string>
  onEstiloChange: (v: string) => void
  onBedChange: (v: string) => void
  onSizeChange: (v: string) => void
  onSortChange: (v: string) => void
}

const BED_OPTIONS = ['1', '2', '3', '4+'] as const

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'S', label: '–60m²' },
  { value: 'SM', label: '60–90m²' },
  { value: 'M', label: '90–130m²' },
  { value: 'L', label: '130–180m²' },
  { value: 'XL', label: '180–240m²' },
  { value: 'XXL', label: '+240m²' },
]

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recommended', label: '+ Relevante' },
  { value: 'price-asc', label: 'Precio ↑' },
  { value: 'price-desc', label: 'Precio ↓' },
]

export default function StickyFilters({
  estiloFilter,
  bedFilter,
  sizeFilter,
  sortOrder,
  availableEstilos,
  enabledBeds,
  enabledSizes,
  enabledEstilos,
  onEstiloChange,
  onBedChange,
  onSizeChange,
  onSortChange,
}: StickyFiltersProps) {
  // Una opción está habilitada si:
  //   - no le pasamos sets de "enabled" (modo retro-compat / sin filtros activos), o
  //   - está en el set, o
  //   - es la opción ya activa (para poder destildarla).
  const isBedEnabled = (v: string) =>
    !enabledBeds || enabledBeds.has(v) || bedFilter === v
  const isSizeEnabled = (v: string) =>
    !enabledSizes || enabledSizes.has(v) || sizeFilter === v
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

        {/* DORMITORIOS — pills */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Dorm.</span>
          {BED_OPTIONS.map((v) => {
            const enabled = isBedEnabled(v)
            return (
              <button
                key={v}
                type="button"
                className={`cf-stf-pill ${bedFilter === v ? 'active' : ''} ${
                  enabled ? '' : 'cf-stf-pill-disabled'
                }`}
                disabled={!enabled}
                onClick={() => onBedChange(bedFilter === v ? '' : v)}
              >
                {v}
              </button>
            )
          })}
        </div>

        {/* SUPERFICIE — pills */}
        <div className="cf-stf-group">
          <span className="cf-stf-lbl">Superficie</span>
          {SIZE_OPTIONS.map((s) => {
            const enabled = isSizeEnabled(s.value)
            return (
              <button
                key={s.value}
                type="button"
                className={`cf-stf-pill ${sizeFilter === s.value ? 'active' : ''} ${
                  enabled ? '' : 'cf-stf-pill-disabled'
                }`}
                disabled={!enabled}
                onClick={() => onSizeChange(sizeFilter === s.value ? '' : s.value)}
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
