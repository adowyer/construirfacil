/**
 * components/admin/AttributeSelector.tsx
 *
 * Render de los atributos del catálogo agrupados por attribute_type.
 * Cada grupo es un <details> colapsable nativo — sin estado cliente.
 * Auto-abre los grupos que tienen al menos un valor ya seleccionado.
 *
 * Usa checkboxes nativos (name="attribute_ids") — al submit el form,
 * FormData.getAll('attribute_ids') devuelve los attribute_value_id seleccionados.
 *
 * NOTA: usamos "attribute_ids" y NO "attributes" porque `<form>.attributes`
 * es una propiedad nativa del DOM (NamedNodeMap) y un input con name=
 * "attributes" la pisa, lo cual causa hydration mismatch en React.
 *
 * Pensado para ser embebido dentro de ModelForm (client component).
 */

import type { AttributeTypeWithValues } from '@/types/database'

interface AttributeSelectorProps {
  attributeTypes: AttributeTypeWithValues[]
  selectedValueIds: string[]
}

export function AttributeSelector({
  attributeTypes,
  selectedValueIds,
}: AttributeSelectorProps) {
  const selected = new Set(selectedValueIds)

  if (attributeTypes.length === 0) {
    return (
      <p className="text-xs text-neutral-400">
        No hay tipos de atributo cargados. Andá a{' '}
        <a href="/admin/attributes" className="underline hover:no-underline">
          /admin/attributes
        </a>{' '}
        para configurarlos.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {attributeTypes.map((type) => {
        const total = type.attribute_values.length
        const count = type.attribute_values.filter((v) => selected.has(v.id)).length
        const isOpen = count > 0

        return (
          <details
            key={type.id}
            open={isOpen}
            className="group border border-[#E8E8E5] rounded-lg overflow-hidden"
          >
            <summary
              className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-neutral-50 transition-colors list-none [&::-webkit-details-marker]:hidden"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden="true"
                  className="text-neutral-400 transition-transform duration-150 group-open:rotate-90"
                >
                  ›
                </span>
                <span className="text-sm font-medium truncate">{type.name}</span>
              </span>
              <span
                className={`text-[11px] uppercase tracking-widest tabular-nums shrink-0 ${
                  count > 0 ? 'text-black font-semibold' : 'text-neutral-400'
                }`}
              >
                {count} / {total}
              </span>
            </summary>

            <div className="px-4 py-3 border-t border-[#E8E8E5] bg-neutral-50/40">
              {total === 0 ? (
                <p className="text-xs text-neutral-400 italic">
                  Sin valores cargados.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5">
                  {type.attribute_values.map((v) => (
                    <label
                      key={v.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="attribute_ids"
                        value={v.id}
                        defaultChecked={selected.has(v.id)}
                        className="w-4 h-4 accent-black shrink-0"
                      />
                      <span className="leading-tight">{v.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}
