/**
 * app/(public)/models/[slug]/page.tsx
 *
 * Slug = variant_code for real Supabase rows (e.g. HPR02_1_I)
 *       = slug field for mock rows (e.g. timbo-ii)
 *
 * Fetch order: Supabase by variant_code → mock by slug → 404
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { getModelByVariantCode } from '@/lib/supabase/queries/models'
import type { HouseCatalogRow } from '@/lib/supabase/queries/models'
import { getMockHouseDetail, MOCK_HOUSES } from '@/lib/supabase/mock-data'
import ModelPlaceholder from '@/components/catalog/ModelPlaceholder'

// ── Cover images keyed by variant_code ───────────────────────────────────────
const _B = 'https://posadasalrio.construirfacil.com/wp-content/uploads/2025/11/'
const COVER_IMAGE_MAP: Record<string, string> = {
  HPR02_1_I: _B + 'living-t2.png',
  HPR01_2_I: _B + 'Estilo-2-6.png',
  HPR03_1_I: _B + 'casa3_opc1_2_posadas_PBjpg.jpg',
  HPR01_3_I: _B + 'Image-from-Google-Drive-1-1-2.png',
  HPR01_1_II: _B + 'Interiores-Typologia-1-IMG2-2-e1764112587890.png',
  HPR02_3_II: _B + 'R-2-PLANTAS-D3.1.jpg',
  HPR03_3_I: _B + '3opc2_PB_posadas.png',
  HPR02_2_II: _B + 'R-2-PLANTAS-D-2.4.jpg',
  HPR02_1_II: _B + 'R-2-PLANTAS-D1.2-1.jpg',
  HPR01_3_II: _B + 'Image-from-Google-Drive-2-2.png',
  HPR02_3_I: _B + 'R-1-PLANTA-D3.1.jpg',
  HPR01_1_I: _B + 'Image-from-Google-Drive-4.png',
  HPR03_3_II: _B + 'casa_opc3_1_posadas-2.jpg',
  HPR03_2_II: _B + '3OPC2_2_posadas-2.png',
  HPR01_2_II: _B + 'Image-from-Google-Drive-1-3.png',
  HPR03_1_II: _B + 'casa3_opc1_2_posadas-2-1.jpg',
  HPR02_2_I: _B + 'living-t2.png',
  HPR03_2_I: _B + '3opc2_PB_posadas.png',
}

// ── Gallery images keyed by variant_code ─────────────────────────────────────
const GALLERY_MAP: Record<string, string[]> = {
  HPR02_1_I: [
    _B + 'living-t2.png',
    _B + 'R-1-PLANTA-600x400.jpg',
    _B + 'cocina-t2-600x400.png',
    _B + 'R-1-PLANTA-D1.2-600x347.jpg',
    _B + 'R-1-PLANTA-D1.3-600x400.jpg',
  ],
  HPR02_3_II: [
    _B + 'R-2-PLANTAS-D3.1.jpg',
    _B + 'R-2-PLANTAS-D3.3.jpg',
    _B + 'R-2-PLANTAS-D3.2-3.jpg',
    _B + 'R-2-PLANTAS-D3.0.jpg',
    _B + 'cocina-t2.png',
    _B + 'playroom-t2-1.png',
    _B + 'living-t2.png',
  ],
  HPR03_1_I: [
    _B + 'casa3_opc1_2_posadas_PBjpg.jpg',
    _B + 'casa3_opc1_PB.jpg',
    _B + 'interior_generico_posadas.png',
    _B + 'interior_generico2_posadas-2.jpg',
  ],
}

// ── Normalize real Supabase row → detail page shape ───────────────────────────
function normalizeDbHouse(h: HouseCatalogRow): any {
  const imgUrl = COVER_IMAGE_MAP[h.variant_code] ?? null
  const publicPrice = h.public_price_usd ?? 0
  const discount = h.presale_discount_pct ?? 0
  return {
    id: h.id,
    name: h.name,
    slug: h.variant_code,
    description: h.recommended_use ?? null,
    total_area_m2: h.area_m2 ?? 0,
    covered_area_m2: h.area_m2 ?? 0,
    bedrooms: h.min_bedrooms ?? null,
    bathrooms: null,
    floors: h.floors ?? 1,
    garage_spaces: null,
    lot_area_m2: null,
    construction_system: {
      name: h.construction_system ?? 'HAUSIND',
      slug: (h.construction_system ?? '').toLowerCase(),
    },
    constructora: {
      name: 'HAUSIND',
      slug: 'hausind',
      city: 'Posadas',
      province: 'Misiones',
    },
    cover_image: imgUrl ? { storage_url: imgUrl, alt_text: h.name } : null,
    gallery: GALLERY_MAP[h.variant_code] ?? (imgUrl ? [imgUrl] : []),
    gradient_key: 'ph-timbo2',
    price_lista_usd: publicPrice,
    price_contado_usd: Math.round(publicPrice * 0.95),
    price_pozo_usd: Math.round(publicPrice * (1 - discount / 100)),
    tags: [h.variant_style, h.recommended_use].filter(Boolean) as string[],
    attributes: [] as { group: string; value: string }[],
    style: h.variant_style ?? null,
  }
}

// ── Fetch house: try Supabase → mock ─────────────────────────────────────────
async function getHouseForSlug(slug: string): Promise<any | null> {
  try {
    const supabase = await createClient()
    const dbRow = await getModelByVariantCode(supabase, slug)
    if (dbRow) return normalizeDbHouse(dbRow)
  } catch { /* no Supabase */ }
  return getMockHouseDetail(slug) ?? null
}

// ── Static params: mock slugs + real variant codes ───────────────────────────
export async function generateStaticParams() {
  const mockParams = MOCK_HOUSES.map(h => ({ slug: h.slug }))
  try {
    const supabase = await createClient()
    const { getAllVariantCodes } = await import('@/lib/supabase/queries/models')
    const codes = await getAllVariantCodes(supabase)
    return [...mockParams, ...codes.map(c => ({ slug: c }))]
  } catch {
    return mockParams
  }
}

export const revalidate = 60

// ── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const house = await getHouseForSlug(slug)
  if (!house) return { title: 'Modelo no encontrado' }
  return {
    title: `${house.name} — ${house.total_area_m2} m²`,
    description:
      house.description ??
      `Modelo ${house.name} en ${house.construction_system?.name ?? 'construcción en seco'} por ${house.constructora.name}.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function pctOff(lista: number, pozo: number) {
  if (!lista) return 0
  return Math.round(((lista - pozo) / lista) * 100)
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const house = await getHouseForSlug(slug)
  if (!house) notFound()

  const isWood = (house.construction_system?.slug ?? '').includes('wood')
  const discount = pctOff(house.price_lista_usd, house.price_pozo_usd)

  const whatsappNumber = '5491155551234'
  const whatsappText = encodeURIComponent(
    `Hola, me interesa el modelo ${house.name} (${house.total_area_m2} m²). ¿Podría obtener más información?`,
  )

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top nav ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 48px',
          height: '52px',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid #e8e8e8',
        }}
      >
        <a
          href="/"
          className="detail-back-link"
          style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          ← Catálogo
        </a>

        <span style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: '#0a0a0a',
        }}>
          ConstruirFácil
        </span>

        <a
          href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            background: '#0a0a0a',
            textDecoration: 'none',
            padding: '8px 18px',
            letterSpacing: '0.04em',
          }}
        >
          Consultar →
        </a>
      </nav>

      {/* ── Split layout ── */}
      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: '52px' }}>

        {/* Left: gallery column (sticky, scrollable) */}
        <div style={{
          position: 'sticky',
          top: '52px',
          height: 'calc(100vh - 52px)',
          width: '55%',
          flexShrink: 0,
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}>
          {(house.gallery?.length > 0) ? (
            house.gallery.map((url: string, i: number) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={i === 0 ? (house.cover_image?.alt_text || house.name) : `${house.name} ${i + 1}`}
                style={{ display: 'block', width: '100%', objectFit: 'cover', aspectRatio: '4/3' }}
              />
            ))
          ) : house.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={house.cover_image.storage_url}
              alt={house.cover_image.alt_text || house.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ModelPlaceholder
              gradientKey={house.gradient_key}
              name={house.name}
              className="w-full h-full"
              showLabel
            />
          )}
        </div>

        {/* Right: details */}
        <div style={{
          width: '45%',
          overflowY: 'auto',
          padding: '48px 56px',
          fontFamily: 'var(--font-geist), sans-serif',
        }}>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <Badge bg={isWood ? '#EAF0E8' : '#E8EEF5'} color={isWood ? '#4A6B40' : '#3A5A7A'}>
              {house.construction_system?.name ?? 'HAUSIND'}
            </Badge>
            <Badge bg="#F0F0EE" color="#888">
              {house.constructora.name}
            </Badge>
            {(house.constructora.city ?? house.constructora.province) && (
              <Badge bg="#F0F0EE" color="#888">
                {house.constructora.city ?? house.constructora.province}
              </Badge>
            )}
          </div>

          {/* Name */}
          <h1 style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: 'clamp(36px, 4vw, 60px)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 16,
            color: '#0a0a0a',
          }}>
            {house.name}
          </h1>

          {/* Description */}
          {house.description && (
            <p style={{
              fontSize: '14px',
              lineHeight: 1.75,
              color: '#555',
              marginBottom: 32,
              maxWidth: '36em',
            }}>
              {house.description}
            </p>
          )}

          {/* Specs */}
          <section style={{ marginBottom: 32 }}>
            <Label>Especificaciones</Label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: '#e8e8e8',
            }}>
              {([
                { val: house.total_area_m2 ? `${house.total_area_m2} m²` : '—', label: 'Superficie' },
                { val: house.bedrooms != null ? String(house.bedrooms) : '—', label: 'Dormitorios' },
                { val: house.floors != null ? String(house.floors) : '—', label: 'Plantas' },
                { val: house.bathrooms != null ? String(house.bathrooms) : '—', label: 'Baños' },
                { val: house.garage_spaces != null ? String(house.garage_spaces) : '—', label: 'Cochera' },
                { val: house.lot_area_m2 != null ? `${house.lot_area_m2} m²` : '—', label: 'Terreno' },
              ] as { val: string; label: string }[]).map(({ val, label }) => (
                <div key={label} style={{ background: '#f7f7f5', padding: '14px 16px' }}>
                  <p style={{ fontSize: '22px', fontWeight: 600, color: '#0a0a0a', marginBottom: 2, letterSpacing: '-0.02em' }}>
                    {val}
                  </p>
                  <p style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Tags */}
          {house.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32 }}>
              {house.tags.map((tag: string) => (
                <span key={tag} style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 12px',
                  border: '1px solid #e8e8e8',
                  color: '#888',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Attributes */}
          {house.attributes.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <Label>Características</Label>
              <dl style={{ borderTop: '1px solid #e8e8e8' }}>
                {house.attributes.map(({ group, value }: { group: string; value: string }) => (
                  <div key={group} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid #e8e8e8',
                  }}>
                    <dt style={{ fontSize: '13px', color: '#888' }}>{group}</dt>
                    <dd style={{ fontSize: '13px', fontWeight: 600, color: '#0a0a0a' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Pricing */}
          {house.price_lista_usd > 0 && (
            <section style={{ marginBottom: 32 }}>
              <Label>Precio de construcción</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PriceRow
                  label="Precio lista"
                  amount={fmtUSD(house.price_lista_usd)}
                  perM2={fmtUSD(house.price_lista_usd / house.total_area_m2)}
                />
                <PriceRow
                  label="Precio contado"
                  amount={fmtUSD(house.price_contado_usd)}
                  perM2={fmtUSD(house.price_contado_usd / house.total_area_m2)}
                />
                <PriceRow
                  label="Al pozo"
                  badge={discount > 0 ? `-${discount}%` : undefined}
                  amount={fmtUSD(house.price_pozo_usd)}
                  perM2={fmtUSD(house.price_pozo_usd / house.total_area_m2)}
                  featured
                />
              </div>
            </section>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                background: '#0a0a0a',
                padding: '14px',
                textDecoration: 'none',
                letterSpacing: '0.04em',
              }}
            >
              Consultar con {house.constructora.name} →
            </a>

            <Link
              href="/"
              style={{
                display: 'block',
                textAlign: 'center',
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#0a0a0a',
                border: '1px solid #e8e8e8',
                padding: '14px',
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              Ver todos los modelos
            </Link>
          </div>

          <p style={{ fontSize: '11px', color: '#bbb', lineHeight: 1.65 }}>
            Precios en USD. Valores orientativos al pozo. El precio final depende
            del terreno, terminaciones elegidas y ubicación de la obra. Consultá
            directamente con la constructora para una cotización personalizada.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Small UI components ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-geist), sans-serif',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: '#bbb',
      marginBottom: 12,
    }}>
      {children}
    </p>
  )
}

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-geist), sans-serif',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      background: bg,
      color,
      padding: '4px 10px',
    }}>
      {children}
    </span>
  )
}

function PriceRow({
  label, badge, amount, perM2, featured,
}: {
  label: string; badge?: string; amount: string; perM2: string; featured?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      border: featured ? '1px solid #0a0a0a' : '1px solid #e8e8e8',
      background: featured ? '#f7f7f5' : '#fff',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888' }}>
            {label}
          </p>
          {badge && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: featured ? '#fff' : '#0a0a0a',
              background: featured ? '#0a0a0a' : '#e8e8e8',
              padding: '2px 7px',
            }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: '#0a0a0a',
        }}>
          {amount}
        </p>
      </div>
      <p style={{ fontSize: '12px', color: '#aaa' }}>{perM2}/m²</p>
    </div>
  )
}
