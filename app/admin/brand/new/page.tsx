/**
 * app/admin/brand/new/page.tsx
 * Crear un nuevo brand_content desde el panel admin.
 */

import Link from 'next/link'
import { BrandContentForm } from '@/components/admin/BrandContentForm'
import { createBrandContent } from '@/app/admin/brand/actions'

export default function NewBrandContentPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/brand" className="hover:text-black transition-colors">
          Contenido del sitio
        </Link>
        <span>/</span>
        <span className="text-black">Nuevo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Nueva sección
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        La <code>key</code> se setea solo al crear y NO se puede editar después
        — el catálogo público filtra por key.
      </p>

      <BrandContentForm action={createBrandContent} submitLabel="Crear" />
    </div>
  )
}
