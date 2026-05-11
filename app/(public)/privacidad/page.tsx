/**
 * app/(public)/privacidad/page.tsx
 *
 * Página pública con la Política de Privacidad. El contenido vive como
 * markdown en docs/privacidad.md para que sea editable sin tocar JSX
 * (y revisable por el asesor legal).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import { LegalDoc } from '@/components/legal/LegalDoc'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'Política de Privacidad — ConstruirFácil',
  description:
    'Cómo ConstruirFácil recopila, usa y protege los datos personales de los usuarios del sitio.',
}

// Forzamos render estático en build — el .md no cambia entre requests.
export const dynamic = 'force-static'

export default async function PrivacidadPage() {
  const filePath = path.join(process.cwd(), 'docs', 'privacidad.md')
  const md = await fs.readFile(filePath, 'utf8')
  return (
    <>
      <SiteHeader />
      <main className="cf-legal-page">
        <LegalDoc markdown={md} />
      </main>
    </>
  )
}
