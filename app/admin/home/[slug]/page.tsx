/**
 * app/admin/home/[slug]/page.tsx
 * Editor de un slot del HomeRow (slug = home-1..home-5). Create-or-edit;
 * prefilla con el contenido EFECTIVO (fila → B2B hereda B2C → default).
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getHomeSingletonCF,
  getHomeSlideById,
  isHomeKey,
  type HomeVariant,
} from '@/lib/supabase/queries/home_content'
import {
  homeEditorDefaults,
  HOME_TEXT_DEFAULTS,
} from '@/lib/content/home-defaults'
import { HomeSlideForm } from '@/components/admin/HomeSlideForm'
import { HeaderImageUploader } from '@/components/admin/HeaderImageUploader'
import { DeleteHomeSlideButton } from '@/components/admin/DeleteHomeSlideButton'
import {
  createHomeSingleton,
  updateHomeSlide,
  uploadHomeImage,
  removeHomeImage,
} from '@/app/admin/home/actions'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ scope?: string }>
}

export default async function EditHomeSlidePage({
  params,
  searchParams,
}: PageProps) {
  const supabase = await createClient()
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const scope: HomeVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'

  // ── Banner por id (slide_key='banner') ──────────────────────────────
  if (!isHomeKey(slug)) {
    const brow = await getHomeSlideById(supabase, slug)
    if (!brow || brow.slide_key !== 'banner') notFound()
    const bScope: HomeVariant = brow.variant === 'b2b' ? 'b2b' : 'b2c'
    const bName = brow.admin_label || brow.label || '(banner sin título)'
    const bCtx = `Banner · versión ${bScope.toUpperCase()}`
    return (
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
          <Link
            href={`/admin/home?scope=${bScope}`}
            className="hover:text-black transition-colors"
          >
            HomeRow
          </Link>
          <span>/</span>
          <span className="text-black">{bName}</span>
        </div>
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">
              {bName}
            </h1>
            <p className="text-xs text-neutral-400 mt-2">{bCtx}</p>
          </div>
          <DeleteHomeSlideButton id={brow.id} name={bName} scope={bScope} />
        </div>
        <div className="mb-8">
          <HeaderImageUploader
            slideId={brow.id}
            slideName={bName}
            initialImageUrl={brow.image_url}
            uploadAction={uploadHomeImage}
            removeAction={removeHomeImage}
          />
        </div>
        <HomeSlideForm
          action={updateHomeSlide.bind(null, brow.id)}
          defaultValues={brow}
          contextLabel={bCtx}
          submitLabel="Guardar cambios"
          isBanner
        />
      </div>
    )
  }

  const key = slug

  const row = await getHomeSingletonCF(supabase, key, scope)
  const inherited =
    scope === 'b2b' && !row
      ? await getHomeSingletonCF(supabase, key, 'b2c')
      : null

  const name = HOME_TEXT_DEFAULTS[key][scope].label
  const ctx = `${name} · versión ${scope.toUpperCase()}`
  const backHref = `/admin/home?scope=${scope}`

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href={backHref} className="hover:text-black transition-colors">
          HomeRow
        </Link>
        <span>/</span>
        <span className="text-black">{name}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {name}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">{ctx}</p>
        </div>
        {row && (
          <DeleteHomeSlideButton id={row.id} name={name} scope={scope} />
        )}
      </div>

      {row && (
        <div className="mb-8">
          <HeaderImageUploader
            slideId={row.id}
            slideName={name}
            initialImageUrl={row.image_url}
            uploadAction={uploadHomeImage}
            removeAction={removeHomeImage}
          />
        </div>
      )}

      <HomeSlideForm
        action={
          row
            ? updateHomeSlide.bind(null, row.id)
            : createHomeSingleton.bind(null, key, scope)
        }
        defaultValues={homeEditorDefaults(key, scope, row, inherited)}
        contextLabel={ctx}
        submitLabel={row ? 'Guardar cambios' : 'Crear'}
      />

      {!row && (
        <p className="text-xs text-neutral-400 mt-4">
          Al crearlo vas a poder subir la foto de fondo.
        </p>
      )}
    </div>
  )
}
