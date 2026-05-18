/**
 * app/admin/header/new-banner/page.tsx
 * Crear un banner (slide repetible) del header CF, para B2C o B2B.
 */

import Link from 'next/link'
import { createHeaderBanner } from '@/app/admin/header/actions'
import { BannerForm } from '@/components/admin/BannerForm'
import type { HeaderVariant } from '@/lib/supabase/queries/header_content'

interface PageProps {
  searchParams: Promise<{ scope?: string }>
}

export default async function NewHeaderBannerPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const scope: HeaderVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'

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
        <span className="text-black">Nuevo banner</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nuevo banner
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Versión {scope.toUpperCase()}. Después de crearlo vas a poder subir la
        foto de fondo (si querés modo foto).
      </p>

      <BannerForm
        action={createHeaderBanner.bind(null, scope)}
        contextLabel={`Banner · versión ${scope.toUpperCase()}`}
        submitLabel="Crear banner"
      />
    </div>
  )
}
