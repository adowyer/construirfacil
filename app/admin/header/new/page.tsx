/**
 * app/admin/header/new/page.tsx
 * Nueva card de línea (repetible) para una versión. Al crear redirige a su
 * edición (donde aparece el uploader de foto).
 */

import Link from 'next/link'
import { createHeaderLineaCard } from '@/app/admin/header/actions'
import { HeaderSlideForm } from '@/components/admin/HeaderSlideForm'
import type { HeaderVariant } from '@/lib/supabase/queries/header_content'

interface PageProps {
  searchParams: Promise<{ scope?: string }>
}

export default async function NewHeaderLineaCardPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams
  const scope: HeaderVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'
  const ctx = `Nueva card de línea · versión ${scope.toUpperCase()}`

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href={`/admin/header?scope=${scope}`}
          className="hover:text-black transition-colors"
        >
          Header
        </Link>
        <span>/</span>
        <span className="text-black">Nueva card de línea</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva card de línea
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        {ctx}. Después de crearla vas a poder subir la foto de fondo.
      </p>

      <HeaderSlideForm
        action={createHeaderLineaCard.bind(null, scope)}
        contextLabel={ctx}
        submitLabel="Crear card"
      />
    </div>
  )
}
