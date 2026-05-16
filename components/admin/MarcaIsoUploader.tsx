'use client'

/**
 * components/admin/MarcaIsoUploader.tsx
 *
 * ISOTIPO (solo el símbolo) → marcas.iso_url, bucket `marca-logos`
 * (subfolder `iso/`). Activo independiente del isologo (logo_url).
 * Wrapper sobre MarcaImageUploader.
 */

import { MarcaImageUploader } from '@/components/admin/MarcaImageUploader'
import { uploadMarcaIso, removeMarcaIso } from '@/app/admin/marcas/actions'

interface Props {
  marcaId: string
  marcaName: string
  initialIsoUrl: string | null
}

export function MarcaIsoUploader({ marcaId, marcaName, initialIsoUrl }: Props) {
  return (
    <MarcaImageUploader
      marcaId={marcaId}
      marcaName={marcaName}
      initialUrl={initialIsoUrl}
      title="Isotipo"
      hint="Solo el símbolo (sin texto). PNG, JPG, WebP o SVG. Máx 2 MB. Idealmente cuadrado, fondo transparente."
      assetWord="isotipo"
      uploadAction={uploadMarcaIso}
      removeAction={removeMarcaIso}
    />
  )
}
