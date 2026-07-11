import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import './globals.css'
import XimiaWidget from '@/components/ximia/XimiaWidget'
import { ProvinciaProvider } from '@/components/providers/ProvinciaProvider'
import { getProvinciasCached } from '@/lib/supabase/queries/provincias-cached'
import { getNonOperativeProvinciaIds } from '@/lib/supabase/queries/operative-provincias'
import { detectProvinciaSlug } from '@/lib/geo/detect-provincia'
import { PROVINCIA_COOKIE } from '@/lib/cookies/provincia'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ConstruirFácil — Catálogo de modelos de casas en Argentina',
    template: '%s | ConstruirFácil',
  },
  description:
    'Explorá modelos de casas de marcas verificadas en Argentina. Steel frame, mampostería, wood frame y más.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Estado de provincia para el provider:
  //  1) Si hay cookie cf-provincia-id válida → la usamos como initial (no modal).
  //  2) Si hay header geo de Vercel con provincia AR resoluble → sugerida (pre-llena modal).
  //  3) Todas las provincias para el dropdown del modal y resoluciones varias.
  // getProvinciasCached usa unstable_cache (24h + tag 'provincias'): la lista
  // de 24 jurisdicciones casi nunca cambia, no tiene sentido pegarle a la DB
  // en cada render.
  const [provincias, nonOperativeIds, cookieStore, headerStore] =
    await Promise.all([
      getProvinciasCached(),
      getNonOperativeProvinciaIds(),
      cookies(),
      headers(),
    ])

  const cookieProvinciaId = cookieStore.get(PROVINCIA_COOKIE)?.value ?? null
  const validatedInitialId =
    cookieProvinciaId && provincias.some((p) => p.id === cookieProvinciaId)
      ? cookieProvinciaId
      : null

  const suggestedSlug = detectProvinciaSlug(headerStore)
  const suggestedId =
    suggestedSlug && !validatedInitialId
      ? provincias.find((p) => p.slug === suggestedSlug)?.id ?? null
      : null

  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <ProvinciaProvider
          initialProvinciaId={validatedInitialId}
          suggestedProvinciaId={suggestedId}
          provincias={provincias}
          nonOperativeProvinciaIds={nonOperativeIds}
        >
          {children}
          {/* XimiaWidget vive DENTRO del ProvinciaProvider para poder leer
              provincia via useProvincia() y mandarla a n8n como parte del
              context de la conversación. */}
          <XimiaWidget />
        </ProvinciaProvider>
      </body>
    </html>
  )
}
