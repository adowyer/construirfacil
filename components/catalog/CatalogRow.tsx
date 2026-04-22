// @ts-nocheck
'use client'

import Link from 'next/link'
import { useState } from 'react'

interface CatalogRowProps {
  house: any
  index: number
}

function iconSvg(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  const icons = [
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 6L42 20v22H6V20z" fill="none" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" fill="#0a0a0a"/><rect x="15" y="15" width="18" height="18" fill="#fff"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><circle cx="24" cy="24" r="7" fill="#0a0a0a"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="15" fill="#0a0a0a"/><rect x="6" y="27" width="36" height="15" fill="none" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M6 42L24 8l18 34z" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><line x1="24" y1="8" x2="24" y2="42" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
    `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" fill="none" stroke="#0a0a0a" stroke-width="2.5"/><path d="M6 24h36M24 6v36" stroke="#0a0a0a" stroke-width="2.5"/></svg>`,
  ]
  return icons[h % icons.length]
}

function lqipUri(hex: string): string {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6'><rect width='8' height='6' fill='${hex}'/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
}

export default function CatalogRow({ house, index }: CatalogRowProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [hovered, setHovered] = useState(false)

  const systemName =
    typeof house.construction_system === 'string'
      ? house.construction_system
      : house.construction_system?.name ?? ''

  const location = [
    house.constructora?.city,
    house.constructora?.province,
  ].filter(Boolean).join(', ') || house.constructora?.name || ''

  const statusTag = house.style ?? systemName
  const lqip = house.lqip_color ?? '#2a2620'
  const coverUrl = house.cover_image?.storage_url ?? null
  const slug = house.slug ?? house.variant_code ?? house.id

  return (
    <Link
      href={`/models/${slug}`}
      className="catalog-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'stretch',
        minHeight: '440px',
        borderBottom: '1px solid #e8e8e8',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* ── Meta column ── */}
      <div
        className="meta-col"
        style={{
          width: '37%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '48px 40px',
          borderRight: '1px solid #e8e8e8',
          background: '#fff',
        }}
      >
        {/* SVG icon */}
        <div
          style={{ width: 52, height: 52, marginBottom: 20, flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: iconSvg(house.id) }}
        />

        {/* Name */}
        <p style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '18px',
          fontWeight: 400,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          marginBottom: 9,
          color: '#0a0a0a',
        }}>
          {house.name}
        </p>

        {/* Location / constructora */}
        {location && (
          <p style={{
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#999',
          }}>
            {location}
          </p>
        )}

        {/* Status tag */}
        {statusTag && (
          <div style={{
            marginTop: 22,
            fontFamily: 'var(--font-geist), sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: '#c8c8c8',
            border: '1px solid #e8e8e8',
            padding: '4px 12px',
            borderRadius: '100px',
          }}>
            {statusTag}
          </div>
        )}
      </div>

      {/* ── Gallery column ── */}
      <div
        className="gallery-col"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: lqip,
        }}
      >
        {coverUrl ? (
          <>
            {/* LQIP blur placeholder */}
            <img
              src={lqipUri(lqip)}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(22px)',
                transform: 'scale(1.1)',
                opacity: imgLoaded ? 0 : 1,
                transition: 'opacity 0.8s ease',
                zIndex: 1,
              }}
            />
            {/* Real image */}
            <img
              src={coverUrl}
              alt={house.name}
              loading={index === 0 ? 'eager' : 'lazy'}
              onLoad={() => setImgLoaded(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imgLoaded ? 1 : 0,
                zIndex: 2,
                transition: 'opacity 0.7s ease, transform 0.85s cubic-bezier(.2,.8,.2,1)',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          </>
        ) : (
          /* No real image: scale solid color on hover */
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: lqip,
            transition: 'transform 0.85s cubic-bezier(.2,.8,.2,1)',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
          }} />
        )}
      </div>
    </Link>
  )
}
