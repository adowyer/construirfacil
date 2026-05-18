/**
 * app/admin/home/new-banner/page.tsx
 * Crear un banner (slide repetible) del HomeRow CF, para B2C o B2B.
 */

import Link from 'next/link'
import { createHomeBanner } from '@/app/admin/home/actions'
import { HomeSlideForm } from '@/components/admin/HomeSlideForm'
import type { HomeVariant } from '@/lib/supabase/queries/home_content'

interface PageProps {
  searchParams: Promise<{ scope?: string }>
}

export default async function NewHomeBannerPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const scope: HomeVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link
          href={`/admin/home?scope=${scope}`}
          className="hover:text-black transition-colors"
        >
          HomeRow
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

      <HomeSlideForm
        action={createHomeBanner.bind(null, scope)}
        contextLabel={`Banner · versión ${scope.toUpperCase()}`}
        submitLabel="Crear banner"
      />
    </div>
  )
}
