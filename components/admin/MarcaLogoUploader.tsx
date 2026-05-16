'use client'

/**
 * components/admin/MarcaLogoUploader.tsx
 *
 * ISOLOGO (símbolo + texto) → marcas.logo_url, bucket `marca-logos`.
 * Wrapper sobre MarcaImageUploader: conserva la firma de props previa
 * ({ marcaId, marcaName, initialLogoUrl }) para no tocar los call sites
 * existentes. El comportamiento del isologo es idéntico al anterior.
 */

import { MarcaImageUploader } from '@/components/admin/MarcaImageUploader'
import { uploadMarcaLogo, removeMarcaLogo } from '@/app/admin/marcas/actions'

interface Props {
  marcaId: string
  marcaName: string
  initialLogoUrl: string | null
}

export function MarcaLogoUploader({ marcaId, marcaName, initialLogoUrl }: Props) {
  return (
    <MarcaImageUploader
      marcaId={marcaId}
      marcaName={marcaName}
      initialUrl={initialLogoUrl}
      title="Isologo"
      hint="Símbolo + texto (lockup completo). PNG, JPG, WebP o SVG. Máx 2 MB. Fondo transparente."
      assetWord="isologo"
      uploadAction={uploadMarcaLogo}
      removeAction={removeMarcaLogo}
    />
  )
}
