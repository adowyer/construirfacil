/**
 * app/admin/marcas/new/page.tsx
 * Crear una nueva marca desde el panel admin.
 * Owner default: el admin actual (ver actions.ts → createMarca).
 */

import Link from 'next/link'
import { MarcaForm } from '@/components/admin/MarcaForm'
import { createMarca } from '@/app/admin/marcas/actions'

export default function NewMarcaPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/marcas" className="hover:text-black transition-colors">
          Marcas
        </Link>
        <span>/</span>
        <span className="text-black">Nueva marca</span>
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight mb-10">
        Nueva marca
      </h1>

      <MarcaForm action={createMarca} submitLabel="Crear marca" />
    </div>
  )
}
