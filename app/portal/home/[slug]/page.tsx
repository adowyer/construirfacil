/**
 * app/portal/home/[slug]/page.tsx
 * Editor de un slot del HomeRow de la marca (slug = home-1..home-5).
 * Prefilla con el efectivo (fila → default b2c baseline). Snapshot al guardar.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import {
  getMyHomeSingleton,
  isHomeKey,
} from '@/lib/supabase/queries/home_content'
import {
  homeEditorDefaults,
  HOME_TEXT_DEFAULTS,
} from '@/lib/content/home-defaults'
import { HomeSlideForm } from '@/components/admin/HomeSlideForm'
import { HeaderImageUploader } from '@/components/admin/HeaderImageUploader'
import { DeleteMyHomeSlideButton } from '../DeleteMyHomeSlideButton'
import {
  createMyHomeSingleton,
  updateMyHomeSlide,
  uploadMyHomeImage,
  removeMyHomeImage,
} from '../actions'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PortalEditHomeSlidePage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const { slug } = await params
  if (!isHomeKey(slug)) notFound()
  const key = slug

  const row = await getMyHomeSingleton(supabase, marca.id, key)
  const name = HOME_TEXT_DEFAULTS[key].b2c.label
  const ctx = `${name} · tu marca`

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/home" className="hover:text-black transition-colors">
          Mi presentación inferior
        </Link>
        <span>/</span>
        <span className="text-black">{name}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">{name}</h1>
        {row && <DeleteMyHomeSlideButton id={row.id} name={name} />}
      </div>

      {row && (
        <div className="mb-8">
          <HeaderImageUploader
            slideId={row.id}
            slideName={name}
            initialImageUrl={row.image_url}
            uploadAction={uploadMyHomeImage}
            removeAction={removeMyHomeImage}
          />
        </div>
      )}

      <HomeSlideForm
        action={
          row
            ? updateMyHomeSlide.bind(null, row.id)
            : createMyHomeSingleton.bind(null, key)
        }
        defaultValues={homeEditorDefaults(key, 'b2c', row, null)}
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
