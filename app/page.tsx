/**
 * app/page.tsx
 *
 * Landing B2C de ConstruirFácil (default). Para compradores finales: el
 * mensaje gira alrededor de elegir casa, financiación, garantía y atención.
 * La versión B2B vive en /b2b.
 *
 * Comparte el componente <LandingCF> con la B2B — solo cambia la copy.
 */

import type { Metadata } from 'next'
import LandingCF from '@/components/landing/LandingCF'
import { LANDING_B2C } from '@/lib/content/landing-cf'

export const metadata: Metadata = {
  title: 'ConstruirFácil — Elegí tu casa, en un solo lugar',
  description:
    'La manera más inteligente y fácil de Construir. Explorá cientos de modelos de las mejores marcas de casas industrializadas, con financiación, garantía y atención 24/7.',
}

export default function HomePage() {
  return <LandingCF content={LANDING_B2C} />
}
