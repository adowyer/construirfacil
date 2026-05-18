/**
 * app/page.tsx
 *
 * Home de ConstruirFácil. No es una landing separada — el catálogo VIVE acá,
 * solo que arranca con `initialHomeMode={true}`: la grilla de modelos está
 * oculta y se muestra el HomeSlider (segundo slider con copy editorial) entre
 * el HeroRow y donde irían los filtros sticky.
 *
 * Click en cualquier CTA "Ver catálogo" dentro del HomeSlider → toggle a modo
 * catálogo (grilla aparece). Click en "Inicio" del breadcrumb (cuando estamos
 * en modo catálogo) → vuelve a modo home. La transición es client-side, no
 * hay navegación.
 *
 * El armado de datos vive en lib/content/home-data.ts (fuente única,
 * compartida con la landing de campaña /casa-financiada/[localidad]).
 *
 * Si alguien entra directo via /catalogo o /catalogo/{marca}, ese page hace
 * el mismo fetch pero con `initialHomeMode={false}` → entra directo al
 * catálogo desplegado. B2B vive en /empresas (mismo CatalogPage, b2b).
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { loadHomeData } from '@/lib/content/home-data'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil — La manera más inteligente y fácil de construir.',
  description:
    'Explorá cientos de diseños de casas industrializadas de las mejores marcas. Compará líneas, estilos y precios, encontrá tu casa ideal en un solo lugar.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const data = await loadHomeData(supabase)

  return (
    <CatalogPage
      {...data}
      selectedMarca={null}
      initialHomeMode={true}
    />
  )
}
