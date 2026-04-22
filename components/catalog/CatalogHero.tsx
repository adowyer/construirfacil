/**
 * components/catalog/CatalogHero.tsx
 *
 * Minimal white hero — no color sections, no gradients.
 * White background, dark text. Huge condensed headline.
 * The large faded number is decorative background à la big.dk.
 */

export default function CatalogHero({ totalCount }: { totalCount: number }) {
  return (
    <section
      className="relative bg-white overflow-hidden pt-32 pb-16 px-14"
      aria-labelledby="catalog-headline"
    >
      {/* Massive faded number — background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black uppercase leading-none"
        style={{
          fontFamily: 'var(--font-barlow-condensed), sans-serif',
          fontSize: 'clamp(140px, 20vw, 260px)',
          color: 'rgba(13,13,13,0.04)',
          letterSpacing: '-0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {totalCount}+
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-none">
        {/* Small caps eyebrow */}
        <p
          className="text-[#888888] mb-4 tracking-widest uppercase"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.14em',
          }}
        >
          Catálogo de modelos · construirfacil.com
        </p>

        {/* Big headline */}
        <h1
          id="catalog-headline"
          className="text-[#0D0D0D] font-black uppercase leading-none mb-8"
          style={{
            fontFamily: 'var(--font-barlow-condensed), sans-serif',
            fontSize: 'clamp(64px, 8.5vw, 120px)',
            letterSpacing: '-0.02em',
          }}
        >
          ENCONTRÁ
          <br />
          TU&nbsp;/&nbsp;CASA
        </h1>

        {/* Meta row */}
        <div
          className="flex items-center gap-6 flex-wrap"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          {[
            `${totalCount}+ modelos`,
            '20+ constructoras',
            'Wood Frame',
            'Steel Frame',
          ].map((item, i, arr) => (
            <span key={item} className="flex items-center gap-6">
              <span className="text-sm text-[#888888]">{item}</span>
              {i < arr.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-1 h-1 rounded-full bg-[#E8E8E5] flex-shrink-0"
                />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll arrow */}
      <div
        className="absolute bottom-8 right-14 flex flex-col items-center gap-1.5"
        aria-hidden="true"
      >
        <div
          className="w-px h-10 origin-top"
          style={{
            background: 'linear-gradient(to bottom, #0D0D0D, transparent)',
            animation: 'scrollPulse 2s ease-in-out infinite',
          }}
        />
        <span
          className="text-[9px] font-bold uppercase tracking-widest text-[#0D0D0D]/30"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          scroll
        </span>
      </div>
    </section>
  )
}
