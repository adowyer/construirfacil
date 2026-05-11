/**
 * app/(public)/terminos/page.tsx
 *
 * Página pública con los Términos y Condiciones. El contenido vive como
 * markdown en docs/terminos.md para que sea editable sin tocar JSX.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import { LegalDoc } from '@/components/legal/LegalDoc'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — ConstruirFácil',
  description:
    'Términos y condiciones de uso del sitio ConstruirFácil.com.',
}

export const dynamic = 'force-static'

export default async function TerminosPage() {
  const filePath = path.join(process.cwd(), 'docs', 'terminos.md')
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
