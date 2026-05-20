'use client'

/**
 * components/admin/ModelContentForm.tsx
 *
 * Form admin para crear/editar `model_content` por (style_name, linea).
 * Una sola fila editorial sirve a todas las variantes del mismo modelo.
 *
 * lifestyle_tags se renderiza como chip input — al submit se serializa
 * como JSON en un hidden input ('lifestyle_tags').
 */

import { useActionState, useState } from 'react'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import { RichTextEditor } from '@/components/admin/RichTextEditor'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface ModelContentFormProps {
  action: ActionFn
  styleName: string
  linea: string
  defaultValues?: ModelContentRow | null
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

const RECOMMENDED_USES = [
  'Vivienda permanente',
  'Casa de fin de semana',
  'Alquiler turístico',
  'Inversión / renta',
  'Vacacional',
] as const

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
      {hint && (
        <span className="ml-2 normal-case tracking-normal text-neutral-300">{hint}</span>
      )}
    </label>
  )
}

function ChipsInput({
  initial,
  inputName,
}: {
  initial: string[]
  inputName: string
}) {
  const [tags, setTags] = useState<string[]>(initial)
  const [draft, setDraft] = useState('')

  function commit() {
    const v = draft.trim()
    if (!v) return
    if (tags.includes(v)) {
      setDraft('')
      return
    }
    setTags([...tags, v])
    setDraft('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  function remove(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 border border-[#E8E8E5] rounded-lg px-2 py-2 focus-within:border-black transition-colors">
        {tags.map((t) => (
          <span
            key={t}
            className="bg-neutral-100 text-neutral-800 text-xs px-[27px] py-[5px] rounded-full inline-flex items-center gap-1"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="text-neutral-400 hover:text-black transition-colors"
              aria-label={`Quitar ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={tags.length === 0 ? 'familia, naturaleza, modular…' : ''}
          className="flex-1 min-w-[8ch] outline-none text-sm bg-transparent"
        />
      </div>
      <input type="hidden" name={inputName} value={JSON.stringify(tags)} />
      <p className="text-xs text-neutral-400 mt-1">
        Enter o coma para agregar. Consumido por Ximia para recomendaciones.
      </p>
    </div>
  )
}

export function ModelContentForm({
  action,
  styleName,
  linea,
  defaultValues,
}: ModelContentFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Editás <code className="text-neutral-700">model_content</code> de{' '}
        <strong className="text-black">{styleName}</strong> en línea{' '}
        <strong className="text-black">{linea}</strong>. Esta fila editorial sirve
        a todas las variantes del mismo modelo bajo esta línea.
      </p>

      {/* ── Encabezado ────────────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Encabezado público
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              defaultValue={defaultValues?.tagline ?? ''}
              placeholder="Una línea atractiva para el slider público"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="estilo_label">Estilo (label)</Label>
            <input
              type="text"
              id="estilo_label"
              name="estilo_label"
              defaultValue={defaultValues?.estilo_label ?? ''}
              placeholder="ej. Moderna minimalista"
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="body">Descripción larga</Label>
            <RichTextEditor name="body" initialHTML={defaultValues?.body ?? ''} />
          </div>
        </div>
      </fieldset>

      {/* ── Recomendación / target ──────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Recomendación
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-1">
            <Label htmlFor="recommended_use">Uso recomendado</Label>
            <input
              type="text"
              id="recommended_use"
              name="recommended_use"
              defaultValue={defaultValues?.recommended_use ?? ''}
              list="recommended-uses"
              placeholder="Elegí o escribí libre"
              className={inputClass}
            />
            <datalist id="recommended-uses">
              {RECOMMENDED_USES.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="family_size_min">Familia mín.</Label>
            <input
              type="number"
              id="family_size_min"
              name="family_size_min"
              defaultValue={defaultValues?.family_size_min ?? ''}
              min={1}
              step={1}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="family_size_max">Familia máx.</Label>
            <input
              type="number"
              id="family_size_max"
              name="family_size_max"
              defaultValue={defaultValues?.family_size_max ?? ''}
              min={1}
              step={1}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="lifestyle_tags">Lifestyle tags</Label>
          <ChipsInput
            initial={defaultValues?.lifestyle_tags ?? []}
            inputName="lifestyle_tags"
          />
        </div>
      </fieldset>

      {/* ── Notas para Ximia ────────────────────────────────────── */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Notas internas (Ximia)
        </legend>
        <div>
          <Label
            htmlFor="agent_notes"
            hint="lo lee Ximia, no se muestra al público"
          >
            Agent notes
          </Label>
          <textarea
            id="agent_notes"
            name="agent_notes"
            defaultValue={defaultValues?.agent_notes ?? ''}
            rows={5}
            placeholder="Detalles, fortalezas, contraindicaciones… para que Ximia recomiende mejor."
            className={`${inputClass} resize-none`}
          />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar contenido'}
        </button>
      </div>
    </form>
  )
}
