/**
 * components/portal/ModelForm.tsx
 *
 * Shared form for creating and editing house models.
 * Handles: all model fields, attribute multi-select, draft/submit workflow.
 *
 * On create:  inserts house_model + house_model_attributes, then redirects to edit page.
 * On update:  updates house_model + replaces house_model_attributes.
 *
 * Status rules enforced here (mirrors DB constraints):
 *   - Save as draft: status stays 'draft'
 *   - Submit for review: status → 'pending_review'
 *   - Once in pending_review/published, only an admin can change status
 *     (constructora can only edit content fields, not submit again until rejected)
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import type {
  AttributeTypeWithValues,
  ConstructionSystem,
  HouseModelDetail,
} from '@/types/database'

interface Props {
  constructoraId: string
  constructionSystems: ConstructionSystem[]
  attributeTypes: AttributeTypeWithValues[]
  model?: HouseModelDetail               // undefined = new model
  selectedAttributeValueIds?: string[]   // pre-selected for edit mode
}

type FormData = {
  name: string
  description: string
  construction_system_id: string
  bedrooms: string
  bathrooms: string
  total_area_m2: string
  covered_area_m2: string
  lot_area_m2: string
  garage_spaces: string
  price_from_usd: string
  price_from_ars: string
}

export default function ModelForm({
  constructoraId,
  constructionSystems,
  attributeTypes,
  model,
  selectedAttributeValueIds = [],
}: Props) {
  const router = useRouter()
  const isEditing = !!model

  const [form, setForm] = useState<FormData>({
    name: model?.name ?? '',
    description: model?.description ?? '',
    construction_system_id: model?.construction_system_id ?? '',
    bedrooms: String(model?.bedrooms ?? ''),
    bathrooms: String(model?.bathrooms ?? ''),
    total_area_m2: String(model?.total_area_m2 ?? ''),
    covered_area_m2: String(model?.covered_area_m2 ?? ''),
    lot_area_m2: String(model?.lot_area_m2 ?? ''),
    garage_spaces: String(model?.garage_spaces ?? ''),
    price_from_usd: String(model?.price_from_usd ?? ''),
    price_from_ars: String(model?.price_from_ars ?? ''),
  })

  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    new Set(selectedAttributeValueIds),
  )

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmitForReview =
    !isEditing ||
    model?.status === 'draft' ||
    model?.status === 'rejected'

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleAttributeValue(valueId: string) {
    setSelectedValues((prev) => {
      const next = new Set(prev)
      if (next.has(valueId)) {
        next.delete(valueId)
      } else {
        next.add(valueId)
      }
      return next
    })
  }

  function parsePositiveFloat(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) || n <= 0 ? null : n
  }

  function parseNonNegativeInt(val: string): number | null {
    const n = parseInt(val, 10)
    return isNaN(n) || n < 0 ? null : n
  }

  async function handleSave(submitForReview: boolean) {
    setError(null)
    setSaving(true)

    const supabase = createClient()

    const totalArea = parsePositiveFloat(form.total_area_m2)
    const bedrooms = parseNonNegativeInt(form.bedrooms)
    const bathrooms = parseNonNegativeInt(form.bathrooms)

    if (!form.name.trim()) {
      setError('El nombre es obligatorio.')
      setSaving(false)
      return
    }
    if (!totalArea) {
      setError('La superficie total es obligatoria y debe ser mayor a 0.')
      setSaving(false)
      return
    }
    if (bedrooms === null) {
      setError('El número de dormitorios es obligatorio.')
      setSaving(false)
      return
    }
    if (bathrooms === null) {
      setError('El número de baños es obligatorio.')
      setSaving(false)
      return
    }

    const modelData = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      construction_system_id: form.construction_system_id || null,
      bedrooms,
      bathrooms,
      total_area_m2: totalArea,
      covered_area_m2: parsePositiveFloat(form.covered_area_m2),
      lot_area_m2: parsePositiveFloat(form.lot_area_m2),
      garage_spaces: parseNonNegativeInt(form.garage_spaces),
      price_from_usd: parsePositiveFloat(form.price_from_usd),
      price_from_ars: parsePositiveFloat(form.price_from_ars),
    }

    let modelId: string

    if (isEditing) {
      // Determine new status
      let newStatus = model!.status
      if (submitForReview && canSubmitForReview) {
        newStatus = 'pending_review'
      }

      const { error: updateError } = await supabase
        .from('house_models')
        .update({ ...modelData, status: newStatus })
        .eq('id', model!.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      modelId = model!.id
    } else {
      const slug = slugify(form.name)
      const status = submitForReview ? 'pending_review' : 'draft'

      const { data: inserted, error: insertError } = await supabase
        .from('house_models')
        .insert({ ...modelData, constructora_id: constructoraId, slug, status })
        .select('id')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setError(
            'Ya existe un modelo con ese nombre. Usá un nombre diferente.',
          )
        } else {
          setError(insertError.message)
        }
        setSaving(false)
        return
      }

      modelId = inserted.id
    }

    // Sync attributes: delete all, then re-insert selected
    if (isEditing) {
      await supabase
        .from('house_model_attributes')
        .delete()
        .eq('house_model_id', modelId)
    }

    if (selectedValues.size > 0) {
      const attributeRows = Array.from(selectedValues).map((valueId) => ({
        house_model_id: modelId,
        attribute_value_id: valueId,
      }))

      const { error: attrError } = await supabase
        .from('house_model_attributes')
        .insert(attributeRows)

      if (attrError) {
        setError(`Modelo guardado, pero hubo un error con los atributos: ${attrError.message}`)
        setSaving(false)
        router.push(`/portal/models/${modelId}`)
        router.refresh()
        return
      }
    }

    router.push(`/portal/models/${modelId}`)
    router.refresh()
  }

  const isLocked =
    isEditing &&
    (model?.status === 'pending_review' || model?.status === 'published')

  return (
    <div className="space-y-8">
      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          Este modelo está {model?.status === 'pending_review' ? 'en revisión' : 'publicado'} y no se puede editar.
        </div>
      )}

      <fieldset disabled={isLocked} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Nombre del modelo <span aria-hidden>*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors disabled:bg-neutral-50"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none disabled:bg-neutral-50"
          />
        </div>

        {/* Construction system */}
        <div>
          <label htmlFor="construction_system_id" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
            Sistema constructivo
          </label>
          <select
            id="construction_system_id"
            name="construction_system_id"
            value={form.construction_system_id}
            onChange={handleChange}
            className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors bg-white disabled:bg-neutral-50"
          >
            <option value="">Seleccionar (opcional)</option>
            {constructionSystems.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name}
              </option>
            ))}
          </select>
        </div>

        {/* Numeric specs */}
        <div className="grid grid-cols-2 gap-4">
          {([
            { id: 'bedrooms', label: 'Dormitorios *', type: 'integer' },
            { id: 'bathrooms', label: 'Baños *', type: 'integer' },
            { id: 'total_area_m2', label: 'Sup. total m² *', type: 'decimal' },
            { id: 'covered_area_m2', label: 'Sup. cubierta m²', type: 'decimal' },
            { id: 'lot_area_m2', label: 'Terreno m²', type: 'decimal' },
            { id: 'garage_spaces', label: 'Cocheras', type: 'integer' },
            { id: 'price_from_usd', label: 'Precio desde USD', type: 'decimal' },
            { id: 'price_from_ars', label: 'Precio desde ARS', type: 'decimal' },
          ] as const).map(({ id, label, type }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                {label}
              </label>
              <input
                id={id}
                name={id}
                type="number"
                value={(form as Record<string, string>)[id]}
                onChange={handleChange}
                min={0}
                step={type === 'decimal' ? '0.01' : '1'}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors disabled:bg-neutral-50"
              />
            </div>
          ))}
        </div>

        {/* Attributes */}
        {attributeTypes.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">
              Atributos
            </p>
            <div className="space-y-6">
              {attributeTypes.map((attrType) => (
                <div key={attrType.id}>
                  <p className="text-sm font-semibold mb-3">{attrType.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {attrType.attribute_values.map((val) => {
                      const isSelected = selectedValues.has(val.id)
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => toggleAttributeValue(val.id)}
                          disabled={isLocked}
                          className={`px-3 py-1.5 text-sm border transition-colors ${
                            isSelected
                              ? 'border-black bg-black text-white'
                              : 'border-neutral-300 hover:border-black'
                          } disabled:opacity-50 disabled:cursor-default`}
                          aria-pressed={isSelected}
                        >
                          {val.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Actions */}
      {!isLocked && (
        <div className="flex gap-4 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="border border-neutral-300 px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:border-black transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
          {canSubmitForReview && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-black text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
