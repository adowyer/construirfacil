/**
 * app/admin/attributes/page.tsx
 * Admin attribute types list.
 */

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getAttributeTypesWithValues } from '@/lib/supabase/queries/attributes'

export default async function AdminAttributesPage() {
  const supabase = await createClient()
  const types = await getAttributeTypesWithValues(supabase)

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Atributos
        </h1>
        <Link
          href="/admin/attributes/new"
          className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
        >
          + Nuevo tipo
        </Link>
      </div>

      {types.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-neutral-400 mb-4">No hay tipos de atributos definidos.</p>
          <Link
            href="/admin/attributes/new"
            className="inline-block bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
          >
            Crear primer tipo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {types.map((type) => (
            <div key={type.id} className="border border-neutral-200">
              <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 border-b border-neutral-200">
                <div>
                  <p className="font-bold">{type.name}</p>
                  {type.description && (
                    <p className="text-xs text-neutral-400 mt-0.5">{type.description}</p>
                  )}
                </div>
                <div className="flex gap-3 text-xs">
                  <Link
                    href={`/admin/attributes/${type.id}`}
                    className="underline hover:no-underline"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/admin/attributes/${type.id}/values`}
                    className="underline hover:no-underline"
                  >
                    Valores ({type.attribute_values.length})
                  </Link>
                </div>
              </div>
              {type.attribute_values.length > 0 && (
                <div className="px-6 py-3 flex flex-wrap gap-2">
                  {type.attribute_values.map((val) => (
                    <span
                      key={val.id}
                      className="bg-neutral-100 text-neutral-600 px-3 py-1 text-xs"
                    >
                      {val.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
