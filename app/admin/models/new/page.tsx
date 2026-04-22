/**
 * app/admin/models/new/page.tsx
 * Create a new house_catalog entry.
 */

import Link from 'next/link'
import { ModelForm } from '@/components/admin/ModelForm'
import { createModel } from '@/app/admin/models/actions'

export default function NewModelPage() {
  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/models" className="hover:text-black transition-colors">
          Modelos
        </Link>
        <span>/</span>
        <span className="text-black">Nuevo modelo</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Nuevo modelo
      </h1>

      <ModelForm action={createModel} submitLabel="Crear modelo" />
    </div>
  )
}
