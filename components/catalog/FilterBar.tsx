'use client'

/**
 * components/catalog/FilterBar.tsx
 *
 * Sticky minimal filter bar. No pill buttons — underline / color active state.
 * Thin bottom border only. Sort dropdown right-aligned.
 *
 * Filter keys map:
 *   system:   'all' | 'wood-frame' | 'steel-frame'
 *   bedrooms: 'all' | '1' | '2-3' | '4+'
 *   price:    'all' | 'budget' | 'premium'
 *   sort:     'default' | 'price-asc' | 'price-desc' | 'm2-asc' | 'm2-desc'
 */

export type SystemFilter  = 'all' | 'wood-frame' | 'steel-frame'
export type BedroomFilter = 'all' | '1' | '2-3' | '4+'
export type PriceFilter   = 'all' | 'budget' | 'premium'
export type SortKey       = 'default' | 'price-asc' | 'price-desc' | 'm2-asc' | 'm2-desc'

export interface ActiveFilters {
  system: SystemFilter
  bedrooms: BedroomFilter
  price: PriceFilter
  sort: SortKey
}

interface FilterBarProps {
  filters: ActiveFilters
  onChange: (next: ActiveFilters) => void
  resultCount: number
}

interface FilterLinkProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterLink({ label, active, onClick }: FilterLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-shrink-0 text-sm font-semibold transition-colors duration-150 cursor-pointer bg-transparent border-0 outline-none"
      style={{
        fontFamily: 'var(--font-inter), sans-serif',
        color: active ? '#17B4D8' : '#888888',
        paddingBottom: '2px',
        fontSize: '12px',
        letterSpacing: '0.02em',
      }}
      aria-pressed={active}
    >
      {label}
      {/* Active underline */}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-px bg-[#17B4D8]"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

function Sep() {
  return (
    <div
      aria-hidden="true"
      className="flex-shrink-0 w-px bg-[#E8E8E5] mx-1"
      style={{ height: '18px' }}
    />
  )
}

export default function FilterBar({ filters, onChange, resultCount }: FilterBarProps) {
  function setSystem(system: SystemFilter) {
    onChange({ ...filters, system })
  }
  function setBedrooms(bedrooms: BedroomFilter) {
    onChange({ ...filters, bedrooms })
  }
  function setPrice(price: PriceFilter) {
    onChange({ ...filters, price })
  }
  function setSort(sort: SortKey) {
    onChange({ ...filters, sort })
  }

  return (
    <div
      className="sticky z-40 bg-white/97 border-b border-[#E8E8E5]"
      style={{
        top: '65px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      role="search"
      aria-label="Filtros del catálogo"
    >
      <div className="flex items-center gap-3 px-14 py-3 overflow-x-auto scrollbar-none flex-nowrap">
        {/* Label */}
        <span
          className="flex-shrink-0 text-[#BBBBB8] uppercase tracking-widest"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
          }}
        >
          Filtrar
        </span>

        {/* System filters */}
        <FilterLink
          label="Todos"
          active={filters.system === 'all' && filters.bedrooms === 'all' && filters.price === 'all'}
          onClick={() => onChange({ ...filters, system: 'all', bedrooms: 'all', price: 'all' })}
        />
        <Sep />
        <FilterLink
          label="Wood Frame"
          active={filters.system === 'wood-frame'}
          onClick={() => setSystem(filters.system === 'wood-frame' ? 'all' : 'wood-frame')}
        />
        <FilterLink
          label="Steel Frame"
          active={filters.system === 'steel-frame'}
          onClick={() => setSystem(filters.system === 'steel-frame' ? 'all' : 'steel-frame')}
        />
        <Sep />

        {/* Bedroom filters */}
        <FilterLink
          label="1 dorm."
          active={filters.bedrooms === '1'}
          onClick={() => setBedrooms(filters.bedrooms === '1' ? 'all' : '1')}
        />
        <FilterLink
          label="2–3 dorm."
          active={filters.bedrooms === '2-3'}
          onClick={() => setBedrooms(filters.bedrooms === '2-3' ? 'all' : '2-3')}
        />
        <FilterLink
          label="4+ dorm."
          active={filters.bedrooms === '4+'}
          onClick={() => setBedrooms(filters.bedrooms === '4+' ? 'all' : '4+')}
        />
        <Sep />

        {/* Price filters */}
        <FilterLink
          label="Hasta $200k"
          active={filters.price === 'budget'}
          onClick={() => setPrice(filters.price === 'budget' ? 'all' : 'budget')}
        />
        <FilterLink
          label="+$400k"
          active={filters.price === 'premium'}
          onClick={() => setPrice(filters.price === 'premium' ? 'all' : 'premium')}
        />

        {/* Right side: count + sort */}
        <div className="ml-auto flex items-center gap-4 flex-shrink-0">
          <span
            className="text-[#BBBBB8]"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {resultCount} {resultCount === 1 ? 'modelo' : 'modelos'}
          </span>

          <label className="sr-only" htmlFor="sort-select">Ordenar por</label>
          <select
            id="sort-select"
            value={filters.sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-[#0D0D0D] border border-[#E8E8E5] rounded-lg py-1 pl-2 pr-7 outline-none focus:border-[#17B4D8] appearance-none cursor-pointer"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="default">Por defecto</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="m2-asc">M²: menor a mayor</option>
            <option value="m2-desc">M²: mayor a menor</option>
          </select>
        </div>
      </div>
    </div>
  )
}
