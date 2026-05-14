'use client'

/**
 * components/SiteHeader.tsx
 *
 * Header sticky del sitio. Tres modos:
 *
 *  1. Sin props → render legacy: logo HAUSIND a la izquierda + logo CF a la
 *     derecha. Usado en páginas legales (privacidad/términos) y como
 *     fallback para vistas que aún no migran al breadcrumb.
 *
 *  2. `marcaContext = { selectedMarca: null, ... }` → agregador CF:
 *     logo ConstruirFácil grande a la izquierda + breadcrumb a la derecha
 *     con select destacado para elegir marca (Home › Catálogo [Todas ▾]).
 *
 *  3. `marcaContext = { selectedMarca: <Marca>, ... }` → catálogo de marca:
 *     logo de la marca a la izquierda + breadcrumb completo a la derecha
 *     (Home › Catálogo [▾] › {Marca}) + logo CF chico al extremo derecho
 *     como sello del agregador.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'

interface MarcaLite {
  name: string
  slug: string
  logo_url?: string | null
}

interface SiteHeaderProps {
  marcaContext?: {
    selectedMarca: MarcaLite | null
    availableMarcas: MarcaLite[]
  }
}

export default function SiteHeader({ marcaContext }: SiteHeaderProps = {}) {
  const router = useRouter()

  // ── Modo legacy (sin breadcrumb) ────────────────────────────────────
  if (!marcaContext) {
    return (
      <header className="cf-site-header">
        <Link
          href="/"
          aria-label="Hausind — Volver al inicio"
          className="cf-site-header-hausind-link"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Hausind-Logo.png"
            alt="HAUSIND — La construcción inteligente"
            className="cf-site-header-hausind"
          />
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cf_logo_gris.png"
          alt="ConstruirFácil"
          className="cf-site-header-cf"
        />
      </header>
    )
  }

  const { selectedMarca, availableMarcas } = marcaContext
  const isAggregator = selectedMarca === null

  const handleMarcaChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === '__all') router.push('/catalogo')
    else router.push(`/catalogo/${value}`)
  }

  return (
    <header className="cf-site-header cf-site-header--with-crumb">
      {/* ── Lado izquierdo: logo de marca (si hay) + breadcrumb ── */}
      <div className="cf-site-header-left">
        {!isAggregator && (
          <Link
            href={`/catalogo/${selectedMarca!.slug}`}
            aria-label={`Catálogo ${selectedMarca!.name}`}
            className="cf-site-header-brand-link"
          >
            {selectedMarca!.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedMarca!.logo_url}
                alt={selectedMarca!.name}
                className="cf-site-header-brand-logo"
              />
            ) : selectedMarca!.slug === 'hausind' ? (
              // Fallback hasta que se setee logo_url en DB.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/Hausind-Logo.png"
                alt="HAUSIND"
                className="cf-site-header-brand-logo"
              />
            ) : (
              <span className="cf-site-header-brand-text">
                {selectedMarca!.name}
              </span>
            )}
          </Link>
        )}

        <nav className="cf-crumb" aria-label="Navegación de catálogo">
          <Link href="/" className="cf-crumb-link">
            Inicio
          </Link>
          <span className="cf-crumb-sep" aria-hidden="true">
            ›
          </span>

          {/* "Todas las marcas" siempre presente — actúa como link al
              agregador y como trigger del dropdown. Si estamos en el
              agregador, va destacado (naranja+bold); en modo marca, queda
              en color neutral y el destacado pasa al nombre de la marca. */}
          <div
            className={`cf-crumb-select-wrap${
              isAggregator ? ' cf-crumb-select-wrap--active' : ''
            }`}
          >
            <span className="cf-crumb-select-value">Todas las marcas</span>
            <span className="cf-crumb-select-chevron" aria-hidden="true">
              ▾
            </span>
            <select
              className="cf-crumb-select cf-crumb-select--invisible"
              value={isAggregator ? '__all' : selectedMarca!.slug}
              onChange={handleMarcaChange}
              aria-label="Cambiar marca"
            >
              <option value="__all">Todas las marcas</option>
              {availableMarcas.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {!isAggregator && (
            <>
              <span className="cf-crumb-sep" aria-hidden="true">
                ›
              </span>
              <span className="cf-crumb-current">{selectedMarca!.name}</span>
            </>
          )}
        </nav>
      </div>

      {/* ── Lado derecho: sello CF ─────────────────────────────────
          En modo marca, el logo actúa como link al catálogo agregado
          (Inicio › Catálogo). En el agregador, se queda como sello
          estático para evitar un link a sí mismo. */}
      {isAggregator ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/cf_logo_gris.png"
          alt="Por ConstruirFácil"
          className="cf-site-header-cf"
          title="Catálogo agregado por ConstruirFácil"
        />
      ) : (
        <Link
          href="/catalogo"
          aria-label="Ir al catálogo general ConstruirFácil"
          className="cf-site-header-cf-link"
          title="Volver al catálogo general"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cf_logo_gris.png"
            alt="ConstruirFácil — catálogo general"
            className="cf-site-header-cf"
          />
        </Link>
      )}
    </header>
  )
}
