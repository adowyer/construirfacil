/**
 * app/page.tsx
 *
 * Home pública de ConstruirFácil — landing editorial.
 *
 * Reusa los componentes de marca-landing (Hero / System / Solutions /
 * Lineas / Featured / Closeout) con contenido específico para CF:
 * mostrar Flex Build Suit, las 8 ventajas del sistema, soluciones
 * (Smart Box / House / Build) y teaser del catálogo (líneas + featured).
 *
 * El catálogo completo está en /catalogo. La sección "Proyectos a gran
 * escala" del sitio viejo (Argentina/China) queda omitida.
 */

import type { Metadata } from 'next'
import LandingHeader from '@/components/LandingHeader'
import MarcaLanding from '@/components/marca-landing/MarcaLanding'
import { createClient } from '@/lib/supabase/server'
import { getFeaturedModels } from '@/lib/supabase/queries/featured'
import { homeLandingContent } from '@/lib/content/landing/home'
import type { Marca } from '@/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil — Construir más rápido, eficiente, rentable',
  description:
    'La única solución constructiva 100% industrializada del mercado. Catálogo de casas Hausind con sistema Flex Build Suit.',
}

// Marca dummy para MarcaLanding — el componente solo usa `slug` para un
// data-attribute. Hoy CF como agregador no es una "marca" propia en DB,
// pero el shape lo necesitamos para reusar el componente.
const cfMarca = {
  id: 'construirfacil',
  name: 'ConstruirFácil',
  slug: 'construirfacil',
  status: 'approved',
  description: null,
  logo_url: null,
  website_url: null,
  phone: null,
  email: null,
  city: null,
  province: null,
  country: null,
  show_prices: false,
  owner_id: null,
  rejection_reason: null,
  approved_at: null,
  approved_by: null,
  created_at: '',
  updated_at: '',
} as unknown as Marca

export default async function HomePage() {
  const supabase = await createClient()
  const featuredModels = await getFeaturedModels(supabase, 6)

  return (
    <>
      <LandingHeader />
      <MarcaLanding
        marca={cfMarca}
        content={homeLandingContent}
        featuredModels={featuredModels}
      />
    </>
  )
}
