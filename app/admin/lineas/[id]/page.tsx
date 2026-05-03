/**
 * app/admin/lineas/[id]/page.tsx
 * Edit + delete de una línea, con sus campos editoriales (line_content)
 * cargados como defaults.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getLineaById,
  getLineContentForLinea,
} from '@/lib/supabase/queries/lineas'
import { getAllMarcas } from '@/lib/supabase/queries/marcas'
import { LineaForm } from '@/components/admin/LineaForm'
import { DeleteLineaButton } from '@/components/admin/DeleteLineaButton'
import { updateLinea } from '@/app/admin/lineas/actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminLineaEditPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const linea = await getLineaById(supabase, id)

  if (!linea) notFound()

  const [marcas, content] = await Promise.all([
    getAllMarcas(supabase),
    getLineContentForLinea(supabase, linea.name),
  ])
  const approved = marcas.filter((m) => m.status === 'approved')

  const updateLineaWithId = updateLinea.bind(null, id)

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-widest mb-8">
        <Link href="/admin/lineas" className="hover:text-black transition-colors">
          Líneas
        </Link>
        <span>/</span>
        <span className="text-black">{linea.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {linea.name}
          </h1>
          <p className="text-xs text-neutral-400 mt-2">
            Marca: {linea.marca?.name ?? '—'} · slug{' '}
            <code className="text-neutral-500">{linea.slug}</code>
          </p>
        </div>

        <DeleteLineaButton id={id} name={linea.name} />
      </div>

      {/* Edit form */}
      <LineaForm
        action={updateLineaWithId}
        marcas={approved}
        defaultLinea={linea}
        defaultContent={content}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
