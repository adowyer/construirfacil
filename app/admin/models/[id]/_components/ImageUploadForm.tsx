'use client'

/**
 * app/admin/models/[id]/_components/ImageUploadForm.tsx
 *
 * Form to upload a new model image to Supabase Storage and create a
 * matching `model_images` row. The grouping fields (linea, tipologia_code,
 * style_name, model_id) are passed as hidden inputs from the server.
 *
 * Uses `useActionState` like ModelForm for consistent pending/error UX.
 */

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { uploadImage, type ActionResult } from '@/app/admin/models/[id]/image-actions'

type Scope = 'variant' | 'model' | 'typology'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = ActionResult | { ok: null }

interface ImageUploadFormProps {
  modelId: string
  linea: string
  tipologiaCode: string
  styleName: string | null
  variante: string | null
  sistemaConstructivo: string | null
}

// ---------------------------------------------------------------------------
// Wrapper that adapts uploadImage to useActionState's signature
// ---------------------------------------------------------------------------

async function uploadAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return await uploadImage(formData)
}

// ---------------------------------------------------------------------------
// Submit button (uses useFormStatus to avoid double-rendering the parent)
// ---------------------------------------------------------------------------

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
    >
      {pending ? 'Subiendo…' : 'Subir imagen'}
    </button>
  )
}

function ScopeOption({
  value,
  current,
  onSelect,
  disabled,
  title,
  subtitle,
}: {
  value: Scope
  current: Scope
  onSelect: (s: Scope) => void
  disabled?: boolean
  title: string
  subtitle: string
}) {
  const selected = current === value
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      disabled={disabled}
      className={`text-left border rounded-lg px-3 py-2 transition-colors ${
        selected
          ? 'border-black bg-black text-white'
          : 'border-[#E8E8E5] bg-white text-neutral-900 hover:border-neutral-400'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="text-[11px] uppercase tracking-widest font-semibold">
        {title}
      </div>
      <div
        className={`text-[10px] mt-0.5 ${
          selected ? 'text-neutral-300' : 'text-neutral-400'
        }`}
      >
        {subtitle}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function ImageUploadForm({
  modelId,
  linea,
  tipologiaCode,
  styleName,
  variante,
  sistemaConstructivo,
}: ImageUploadFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState<FormState, FormData>(
    uploadAction,
    { ok: null },
  )
  // Scope por defecto: específica de la variante si el modelo tiene los 2 campos;
  // si solo tiene style, "model"; si no tiene ni style, "typology".
  const initialScope: Scope =
    styleName !== null && variante !== null
      ? 'variant'
      : styleName !== null
        ? 'model'
        : 'typology'
  const [scope, setScope] = useState<Scope>(initialScope)

  // Resolver los valores que se mandan según el scope.
  const sentStyle = scope === 'typology' ? '' : (styleName ?? '')
  const sentVariante = scope === 'variant' ? (variante ?? '') : ''

  // After a successful upload, reset the form and refresh the gallery.
  // (revalidatePath inside the action covers SSR fetch; router.refresh forces
  // the active client tree to re-render with the new server state.)
  useEffect(() => {
    if (state.ok === true) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state, router])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-white border border-[#E8E8E5] rounded-xl p-6 space-y-4"
    >
      {/* Hidden context. Los campos style_name/variante varían según el scope. */}
      <input type="hidden" name="model_id" value={modelId} />
      <input type="hidden" name="linea" value={linea} />
      <input type="hidden" name="tipologia_code" value={tipologiaCode} />
      <input type="hidden" name="style_name" value={sentStyle} />
      <input type="hidden" name="variante" value={sentVariante} />
      <input type="hidden" name="sistema_constructivo" value={sistemaConstructivo ?? ''} />

      {state.ok === false && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}
      {state.ok === true && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          Imagen subida correctamente.
        </div>
      )}

      {/* Scope selector */}
      <div>
        <span className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
          Alcance de la imagen
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ScopeOption
            value="variant"
            current={scope}
            onSelect={setScope}
            disabled={variante === null}
            title="Específica de esta variante"
            subtitle={
              variante !== null
                ? `Solo aplica a ${styleName ?? '—'} V${variante}`
                : 'Este modelo no tiene variante — no aplica'
            }
          />
          <ScopeOption
            value="model"
            current={scope}
            onSelect={setScope}
            disabled={styleName === null}
            title="Compartida con el modelo"
            subtitle={
              styleName !== null
                ? `Aplica a todas las variantes de ${styleName}`
                : 'Este modelo no tiene style — no aplica'
            }
          />
          <ScopeOption
            value="typology"
            current={scope}
            onSelect={setScope}
            title="Compartida con la tipología"
            subtitle={`Aplica a todos los modelos de ${linea} T${tipologiaCode}`}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="file"
          className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
        >
          Archivo de imagen *
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="image/*"
          required
          className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-full file:border file:border-[#E8E8E5] file:bg-white file:text-xs file:uppercase file:tracking-widest file:font-semibold hover:file:border-black file:cursor-pointer"
        />
        <p className="text-[11px] text-neutral-400 mt-1">
          JPG, PNG o WebP. Se guarda en{' '}
          <code className="font-mono">
            house-photos/{linea}/{tipologiaCode}/
            {sentStyle || '_shared'}/{sentVariante || '_all'}/
          </code>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="image_type"
            className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
          >
            Tipo
          </label>
          <select
            id="image_type"
            name="image_type"
            defaultValue="render"
            className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white"
          >
            <option value="render">Render</option>
            <option value="plano">Plano</option>
            <option value="axonometria">Axonometría</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="sort_order"
            className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
          >
            Orden
          </label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            step="1"
            min="0"
            defaultValue={0}
            className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div className="flex items-end">
          <label
            htmlFor="is_exterior"
            className="flex items-center gap-2 text-sm select-none cursor-pointer pb-2"
          >
            <input
              id="is_exterior"
              name="is_exterior"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-black"
            />
            <span className="text-[11px] uppercase tracking-widest text-neutral-700">
              Es exterior
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
