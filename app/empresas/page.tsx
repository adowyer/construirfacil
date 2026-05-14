/**
 * app/b2b/page.tsx
 *
 * Landing B2B de ConstruirFácil. Dirigida a marcas / fabricantes que
 * quieran sumar su catálogo al agregador. Mismo layout que la B2C,
 * con copy enfocada en: marketplace, IA, tráfico, catálogo inteligente
 * y acuerdos con marcas para ahorro en materiales.
 *
 * CTA principal: "Sumá tu marca" → mailto a partners.
 * CTA secundario: "Ver catálogo" → /catalogo (también linkeado para que
 * partners interesados vean la experiencia del lado comprador).
 */

import type { Metadata } from 'next'
import LandingCF from '@/components/landing/LandingCF'
import { LANDING_B2B } from '@/lib/content/landing-cf'

export const metadata: Metadata = {
  title: 'ConstruirFácil para Marcas — Sumá tu catálogo al marketplace',
  description:
    'Solución comercial B2B con inteligencia artificial, tráfico garantizado, catálogo inteligente y acuerdos exclusivos en materiales. Sumá tu marca a ConstruirFácil y escalá tus ventas.',
}

export default function B2BPage() {
  return <LandingCF content={LANDING_B2B} />
}
