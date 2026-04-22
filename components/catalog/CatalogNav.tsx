'use client'

import { useState } from 'react'
import Link from 'next/link'

export type NavFilter =
  | 'wood-frame'
  | 'steel-frame'
  | '1-dorm'
  | '2-3-dorm'
  | '4plus-dorm'
  | 'todos'

interface CatalogNavProps {
  activeFilter: NavFilter
  onFilterChange: (f: NavFilter) => void
}

const NAV_ITEMS: { label: string; value: NavFilter }[] = [
  { label: 'Wood Frame',        value: 'wood-frame' },
  { label: 'Steel Frame',       value: 'steel-frame' },
  { label: '1 Dorm.',           value: '1-dorm' },
  { label: '2–3 Dorm.',         value: '2-3-dorm' },
  { label: '4+ Dorm.',          value: '4plus-dorm' },
  { label: 'Todos los modelos', value: 'todos' },
]

export default function CatalogNav({ activeFilter, onFilterChange }: CatalogNavProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav
      className="catalog-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e8e8e8',
      }}
      aria-label="Catálogo de modelos"
    >
      {/* Brand */}
      <Link
        href="/"
        style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: '#0a0a0a',
          textDecoration: 'none',
          flexShrink: 0,
          marginRight: '40px',
        }}
      >
        ConstruirFácil
      </Link>

      {/* Center: filter links */}
      <div
        className="nav-links"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'stretch',
          height: '100%',
          gap: 0,
        }}
        role="list"
      >
        {NAV_ITEMS.map(item => {
          const isActive = activeFilter === item.value
          return (
            <button
              key={item.value}
              type="button"
              role="listitem"
              onClick={() => onFilterChange(item.value)}
              aria-current={isActive ? 'true' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                padding: '0 18px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isActive ? '#0a0a0a' : '#aaa',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'inset 0 -2px 0 #0a0a0a' : 'none',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Right: portal link */}
      <a
        href="/portal"
        style={{
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#aaa',
          textDecoration: 'none',
          flexShrink: 0,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#0a0a0a')}
        onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}
      >
        Constructoras
      </a>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#fff',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '0 48px',
            gap: '32px',
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            style={{
              position: 'absolute',
              top: '18px',
              right: '48px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px',
              color: '#0a0a0a',
            }}
          >
            ×
          </button>
          {NAV_ITEMS.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => { onFilterChange(item.value); setMenuOpen(false) }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist), sans-serif',
                fontSize: '28px',
                fontWeight: 400,
                color: activeFilter === item.value ? '#0a0a0a' : '#bbb',
                padding: 0,
                textAlign: 'left',
              }}
            >
              {item.label}
            </button>
          ))}
          <Link
            href="/portal"
            style={{
              fontFamily: 'var(--font-geist), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#888',
              marginTop: '16px',
            }}
            onClick={() => setMenuOpen(false)}
          >
            Portal Constructoras
          </Link>
        </div>
      )}
    </nav>
  )
}
