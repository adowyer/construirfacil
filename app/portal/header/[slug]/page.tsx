/**
 * app/portal/header/[slug]/page.tsx
 *
 * `[slug]` = kind editable por la marca (crece|flex|lineas-intro) o un uuid
 * (card de línea propia). Verificación de propiedad en el render (defensa en
 * profundidad; las actions también la chequean). pasos/principal NO se
 * editan desde el portal (los gestiona CF).
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyMarca } from '@/lib/supabase/queries/marcas'
import {
  getMyHeaderSingleton,
  getHeaderSlideById,
  type HeaderSlideKind,
} from '@/lib/supabase/queries/header_content'
import { editorDefaults } from '@/lib/content/header-defaults'
import { HeaderSlideForm } from '@/components/admin/HeaderSlideForm'
import { BannerForm } from '@/components/admin/BannerForm'
import { HeaderImageUploader } from '@/components/admin/HeaderImageUploader'
import { DeleteMyHeaderSlideButton } from '../DeleteMyHeaderSlideButton'
import {
  createMyHeaderSingleton,
  updateMyHeaderSlide,
  uploadMyHeaderImage,
  removeMyHeaderImage,
  uploadMyHeaderPanelImage,
  removeMyHeaderPanelImage,
} from '../actions'

const EDITABLE_SINGLETONS = ['crece', 'flex', 'lineas-intro']
const KIND_LABEL: Record<string, string> = {
  crece: 'Casa que crece',
  flex: 'Sistema constructivo',
  'lineas-intro': 'Intro de líneas',
  'linea-card': 'Card de línea',
  banner: 'Banner',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PortalEditHeaderPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const marca = await getMyMarca(supabase, user.id)
  if (!marca) redirect('/portal/onboarding')

  const { slug } = await params

  // ── Singleton editable de la marca ─────────────────────────────────
  if (EDITABLE_SINGLETONS.includes(slug)) {
    const kind = slug as HeaderSlideKind
    const row = await getMyHeaderSingleton(supabase, marca.id, kind)
    const label = KIND_LABEL[kind] ?? kind
    const ctx = `${label} · tu marca`
    const hasImage = kind === 'crece' || kind === 'flex'

    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
          <Link href="/portal/header" className="hover:text-black transition-colors">
            Mi presentación
          </Link>
          <span>/</span>
          <span className="text-black">{label}</span>
        </div>

        <div className="flex items-start justify-between mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {label}
          </h1>
          {row && (
            <DeleteMyHeaderSlideButton id={row.id} name={label} />
          )}
        </div>

        {row && hasImage && (
          <>
            <div className="mb-8">
              <HeaderImageUploader
                slideId={row.id}
                slideName={label}
                initialImageUrl={row.image_url}
                uploadAction={uploadMyHeaderImage}
                removeAction={removeMyHeaderImage}
              />
            </div>
            <div className="mb-8">
              <HeaderImageUploader
                slideId={row.id}
                slideName={`${label} · iso`}
                initialImageUrl={row.panel_image_url}
                label="Iso de la columna"
                helpText="Logo / iso que va en la columna de color del slide. PNG con fondo transparente recomendado. Si lo dejás vacío, se usa el iso por defecto."
                uploadAction={uploadMyHeaderPanelImage}
                removeAction={removeMyHeaderPanelImage}
              />
            </div>
          </>
        )}

        <HeaderSlideForm
          action={
            row
              ? updateMyHeaderSlide.bind(null, row.id)
              : createMyHeaderSingleton.bind(null, kind)
          }
          defaultValues={editorDefaults(kind, row, null)}
          contextLabel={ctx}
          submitLabel={row ? 'Guardar cambios' : 'Crear'}
        />

        {!row && (
          <p className="text-xs text-neutral-400 mt-4">
            Al crearlo vas a poder subir la foto (si el slide la usa).
          </p>
        )}
      </div>
    )
  }

  // ── Card de línea por id (debe ser de la marca y no pinned) ─────────
  const row = await getHeaderSlideById(supabase, slug)
  if (!row || row.marca_id !== marca.id || row.is_cf_pinned) notFound()

  const label = KIND_LABEL[row.slide_kind] ?? row.slide_kind
  const displayName = row.admin_label || row.title || label
  const ctx = `${label} · tu marca`

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/portal/header" className="hover:text-black transition-colors">
          Mi presentación
        </Link>
        <span>/</span>
        <span className="text-black">{displayName}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          {displayName}
        </h1>
        <DeleteMyHeaderSlideButton id={row.id} name={displayName} />
      </div>

      <div className="mb-8">
        <HeaderImageUploader
          slideId={row.id}
          slideName={displayName}
          initialImageUrl={row.image_url}
          uploadAction={uploadMyHeaderImage}
          removeAction={removeMyHeaderImage}
        />
      </div>

      {row.slide_kind === 'banner' ? (
        <BannerForm
          action={updateMyHeaderSlide.bind(null, row.id)}
          defaultValues={row}
          contextLabel={ctx}
          submitLabel="Guardar cambios"
        />
      ) : (
        <HeaderSlideForm
          action={updateMyHeaderSlide.bind(null, row.id)}
          defaultValues={row}
          contextLabel={ctx}
          submitLabel="Guardar cambios"
        />
      )}
    </div>
  )
}
