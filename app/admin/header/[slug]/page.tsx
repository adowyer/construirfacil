/**
 * app/admin/header/[slug]/page.tsx
 *
 * `[slug]` = un kind singleton/pinned (pasos|principal|crece|flex|
 * lineas-intro) o un uuid (card de línea / fila por id).
 *
 * Singleton/pinned: si la fila no existe, form de "crear" (createHeaderSingleton
 * → redirige acá ya en modo edición). Si existe, edición por id + uploader.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getHeaderSingleton,
  getHeaderSlideById,
  HEADER_SINGLETON_KINDS,
  HEADER_PINNED_KINDS,
  type HeaderSlideKind,
  type HeaderVariant,
} from '@/lib/supabase/queries/header_content'
import { editorDefaults } from '@/lib/content/header-defaults'
import { HeaderSlideForm } from '@/components/admin/HeaderSlideForm'
import { BannerForm } from '@/components/admin/BannerForm'
import { HeaderImageUploader } from '@/components/admin/HeaderImageUploader'
import { DeleteHeaderSlideButton } from '@/components/admin/DeleteHeaderSlideButton'
import {
  createHeaderSingleton,
  updateHeaderSlide,
  uploadHeaderPanelImage,
  removeHeaderPanelImage,
} from '@/app/admin/header/actions'

const KIND_LABEL: Record<string, string> = {
  pasos: 'Pasos',
  principal: 'Principal',
  crece: 'Casa que crece',
  flex: 'Flex Build / Sistema',
  'lineas-intro': 'Intro de líneas',
  'linea-card': 'Card de línea',
  banner: 'Banner',
}

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ scope?: string }>
}

export default async function EditHeaderSlidePage({
  params,
  searchParams,
}: PageProps) {
  const supabase = await createClient()
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const scope: HeaderVariant = sp.scope === 'b2b' ? 'b2b' : 'b2c'

  const isSingleton = (HEADER_SINGLETON_KINDS as string[]).includes(slug)

  // ── Singleton / pinned ─────────────────────────────────────────────
  if (isSingleton) {
    const kind = slug as HeaderSlideKind
    const isPinned = HEADER_PINNED_KINDS.includes(kind)
    const row = await getHeaderSingleton(supabase, kind, scope)
    // B2B hereda B2C: si es b2b no-pinned sin fila propia, prefilla con el
    // contenido de B2C (snapshot al guardar). B2C/pinned no heredan.
    const inherited =
      !isPinned && scope === 'b2b'
        ? await getHeaderSingleton(supabase, kind, 'b2c')
        : null
    const label = KIND_LABEL[kind] ?? kind
    const ctx = isPinned
      ? `${label} · global — afecta TODAS las versiones`
      : `${label} · versión ${scope.toUpperCase()}`
    const hasImage = kind === 'crece' || kind === 'flex'

    const backHref = `/admin/header?scope=${scope}`

    return (
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
          <Link href={backHref} className="hover:text-black transition-colors">
            Header
          </Link>
          <span>/</span>
          <span className="text-black">{label}</span>
        </div>

        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">
              {label}
            </h1>
            <p className="text-xs text-neutral-400 mt-2">{ctx}</p>
          </div>
          {row && (
            <DeleteHeaderSlideButton
              id={row.id}
              name={label}
              scope={scope}
            />
          )}
        </div>

        {row && hasImage && (
          <>
            <div className="mb-8">
              <HeaderImageUploader
                slideId={row.id}
                slideName={label}
                initialImageUrl={row.image_url}
              />
            </div>
            <div className="mb-8">
              <HeaderImageUploader
                slideId={row.id}
                slideName={`${label} · iso`}
                initialImageUrl={row.panel_image_url}
                label="Iso de la columna"
                helpText="Logo / iso que va en la columna de color del slide. PNG con fondo transparente recomendado. Si lo dejás vacío, se usa el iso por defecto."
                uploadAction={uploadHeaderPanelImage}
                removeAction={removeHeaderPanelImage}
              />
            </div>
          </>
        )}

        <HeaderSlideForm
          action={
            row
              ? updateHeaderSlide.bind(null, row.id)
              : createHeaderSingleton.bind(null, kind, scope)
          }
          defaultValues={editorDefaults(kind, row, inherited)}
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

  // ── Por id (card de línea / cualquier fila) ────────────────────────
  const row = await getHeaderSlideById(supabase, slug)
  if (!row) notFound()

  const label = KIND_LABEL[row.slide_kind] ?? row.slide_kind
  const displayName = row.admin_label || row.title || label
  const rowScope: HeaderVariant = row.variant === 'b2b' ? 'b2b' : 'b2c'
  const ctx = `${label} · versión ${rowScope.toUpperCase()}`
  const backHref = `/admin/header?scope=${rowScope}`

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href={backHref} className="hover:text-black transition-colors">
          Header
        </Link>
        <span>/</span>
        <span className="text-black">{displayName}</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {displayName}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">{ctx}</p>
        </div>
        <DeleteHeaderSlideButton
          id={row.id}
          name={displayName}
          scope={rowScope}
        />
      </div>

      <div className="mb-8">
        <HeaderImageUploader
          slideId={row.id}
          slideName={displayName}
          initialImageUrl={row.image_url}
        />
      </div>

      {row.slide_kind === 'banner' ? (
        <BannerForm
          action={updateHeaderSlide.bind(null, row.id)}
          defaultValues={row}
          contextLabel={ctx}
          submitLabel="Guardar cambios"
        />
      ) : (
        <HeaderSlideForm
          action={updateHeaderSlide.bind(null, row.id)}
          defaultValues={row}
          contextLabel={ctx}
          submitLabel="Guardar cambios"
        />
      )}
    </div>
  )
}
