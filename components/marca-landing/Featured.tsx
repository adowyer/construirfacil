/**
 * components/marca-landing/Featured.tsx
 *
 * Teaser editorial de 4–6 modelos destacados. Cards simples (foto +
 * nombre + meta + precio). Click → detalle del modelo.
 */

import type { MarcaFeaturedContent } from '@/lib/content/marca-landing/types'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface FeaturedProps {
  content: MarcaFeaturedContent
  models: CatalogModel[]
}

function formatPrice(price: number | null): string {
  if (!price) return ''
  return `USD ${price.toLocaleString('es-AR')}`
}

function formatBeds(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min == null || max == null) return `${min ?? max} dorm.`
  if (min === max) return `${min} dorm.`
  return `${min}–${max} dorm.`
}

function formatArea(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min == null || max == null) return `${min ?? max} m²`
  if (min === max) return `${min} m²`
  return `${min}–${max} m²`
}

export default function Featured({ content, models }: FeaturedProps) {
  const hasModels = models.length > 0

  return (
    <section className={styles.featured} id="modelos">
      <Reveal className={styles.featuredHeader}>
        <span className={styles.eyebrow}>{content.eyebrow}</span>
        <h2 className={styles.sectionTitle}>{content.title}</h2>
      </Reveal>

      {hasModels && <div className={styles.featuredGrid}>
        {models.map((m, i) => (
          <Reveal
            key={m.group_slug}
            className={styles.featuredCardWrap}
            delay={i * 70}
          >
            <a
              className={styles.featuredCard}
              href={`/?modelo=${encodeURIComponent(m.group_slug)}`}
            >
              <div className={styles.featuredImageWrap}>
                {m.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.featuredImage}
                    src={m.cover_url}
                    alt={m.display_name}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={styles.featuredImageFallback}
                    style={{ backgroundColor: m.lqip_color || '#dcdcd6' }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className={styles.featuredBody}>
                <span className={styles.featuredLine}>
                  Línea {m.linea[0].toUpperCase()}
                  {m.linea.slice(1).toLowerCase()}
                </span>
                <h3 className={styles.featuredName}>{m.display_name}</h3>
                <div className={styles.featuredMeta}>
                  <span>{formatBeds(m.beds_min, m.beds_max)}</span>
                  <span>{formatArea(m.area_min, m.area_max)}</span>
                  {m.price_from != null && (
                    <span className={styles.featuredPrice}>
                      {formatPrice(m.price_from)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          </Reveal>
        ))}
      </div>}

      <Reveal className={styles.featuredCtaWrap}>
        <a className={styles.featuredCtaAll} href={content.ctaAll.href}>
          {content.ctaAll.label}
          <span aria-hidden="true">→</span>
        </a>
      </Reveal>
    </section>
  )
}
