'use client'

/**
 * components/admin/FooterContentForm.tsx
 *
 * Cierre + institucional del footer (singleton CF). Campos vacíos → el
 * catálogo usa el texto por defecto. Las URLs de los CTA del cierre se
 * construyen por código (mailto) — no se editan acá, solo sus labels.
 */

import { useActionState } from 'react'
import type { FooterContentRow } from '@/lib/supabase/queries/footer'

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface Props {
  action: ActionFn
  defaultValues?: FooterContentRow | null
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'

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
        <span className="ml-2 normal-case tracking-normal text-neutral-300">
          {hint}
        </span>
      )}
    </label>
  )
}

export function FooterContentForm({ action, defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-xs text-neutral-500">
        Aplica al footer de todo el sitio (B2C / B2B / marca). Dejá un campo
        vacío para usar el texto por defecto.
      </div>

      {/* Cierre */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Cierre
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eyebrow" hint="línea chica arriba (vacío = sin eyebrow)">
              Eyebrow
            </Label>
            <input
              type="text"
              id="eyebrow"
              name="eyebrow"
              defaultValue={defaultValues?.eyebrow ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="title" hint="default: “Diseñamos tu casa a medida.”">
              Título
            </Label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={defaultValues?.title ?? ''}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cta_primary_label" hint="default: “Contactanos →”">
                Label CTA primario
              </Label>
              <input
                type="text"
                id="cta_primary_label"
                name="cta_primary_label"
                defaultValue={defaultValues?.cta_primary_label ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <Label
                htmlFor="cta_secondary_label"
                hint="default: “Conversar con Ximia”"
              >
                Label CTA secundario
              </Label>
              <input
                type="text"
                id="cta_secondary_label"
                name="cta_secondary_label"
                defaultValue={defaultValues?.cta_secondary_label ?? ''}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Institucional */}
      <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
        <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
          Institucional
        </legend>
        <div className="space-y-4">
          <div>
            <Label
              htmlFor="copyright_text"
              hint="se antepone “© {año}” automáticamente"
            >
              Copyright
            </Label>
            <input
              type="text"
              id="copyright_text"
              name="copyright_text"
              defaultValue={defaultValues?.copyright_text ?? ''}
              placeholder="ConstruirFácil. Todos los derechos reservados."
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="privacy_label">Label Privacidad</Label>
              <input
                type="text"
                id="privacy_label"
                name="privacy_label"
                defaultValue={defaultValues?.privacy_label ?? ''}
                placeholder="Política de Privacidad"
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor="privacy_url" hint="default: /privacidad">
                URL Privacidad
              </Label>
              <input
                type="text"
                id="privacy_url"
                name="privacy_url"
                defaultValue={defaultValues?.privacy_url ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor="terms_label">Label Términos</Label>
              <input
                type="text"
                id="terms_label"
                name="terms_label"
                defaultValue={defaultValues?.terms_label ?? ''}
                placeholder="Términos del Servicio"
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor="terms_url" hint="default: /terminos">
                URL Términos
              </Label>
              <input
                type="text"
                id="terms_url"
                name="terms_url"
                defaultValue={defaultValues?.terms_url ?? ''}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
