'use client'

/**
 * app/admin/promos/PromoForm.tsx
 *
 * Form reusable para crear/editar un promo_message. Usa useActionState con
 * la server action correspondiente (createPromo o updatePromo). Incluye un
 * preview en vivo del CatalogPromoBanner para que el founder vea exactamente
 * cómo va a quedar el banner antes de guardar.
 */

import { useActionState, useState } from 'react'
import Link from 'next/link'
import CatalogPromoBanner from '@/components/catalog/CatalogPromoBanner'
import type {
  PromoColor,
  PromoCtaAction,
  PromoScope,
} from '@/lib/supabase/queries/promos'

type ActionResult = { ok: boolean; error: string | null }
type ActionFn = (prev: ActionResult, formData: FormData) => Promise<ActionResult>

const COLORS: { value: PromoColor; label: string; swatch: string }[] = [
  { value: 'red',    label: 'Rojo',    swatch: '#ff003d' },
  { value: 'cyan',   label: 'Celeste', swatch: '#26b6cf' },
  { value: 'yellow', label: 'Amarillo', swatch: '#f4a72b' },
  { value: 'green',  label: 'Verde',   swatch: '#3aa087' },
]

const SCOPES: { value: PromoScope; label: string; hint: string }[] = [
  { value: 'hero', label: 'Hero', hint: 'Arriba del grid del catálogo (recomendado 1 por contexto)' },
  { value: 'intermediate', label: 'Intermedio', hint: 'Entre filas del catálogo (N permitidos)' },
]

const ACTIONS: { value: PromoCtaAction; label: string; hint: string }[] = [
  { value: 'none',      label: 'Sin botón',          hint: 'Banner solo display' },
  { value: 'contactar', label: 'Quiero que me contacten', hint: 'Abre form ReservarModal genérico' },
  { value: 'ximia',     label: 'Conversar con Ximia',  hint: 'Abre chat (cuando Ximia esté live)' },
  { value: 'saber_mas', label: 'Saber más',            hint: 'Abre modal informativa' },
]

export interface PromoInitial {
  marca_id: string
  provincia_id: string | null
  scope: PromoScope
  titulo: string
  cuerpo: string
  color: PromoColor
  cta_label: string | null
  cta_action: PromoCtaAction
  activo: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}

const DEFAULT_INITIAL: PromoInitial = {
  marca_id: '',
  provincia_id: null,
  scope: 'intermediate',
  titulo: '',
  cuerpo: '',
  color: 'green',
  cta_label: null,
  cta_action: 'none',
  activo: true,
  sort_order: 100,
  starts_at: null,
  ends_at: null,
}

export default function PromoForm({
  action,
  marcas,
  provincias,
  initial = DEFAULT_INITIAL,
  submitLabel = 'Guardar',
}: {
  action: ActionFn
  marcas: { id: string; name: string }[]
  provincias: { id: string; name: string }[]
  initial?: PromoInitial
  submitLabel?: string
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    action,
    { ok: false, error: null },
  )

  // Live preview: replicamos el state del form para alimentar el componente
  // del catálogo público. Sin debounce — los Edits son cheap.
  const [titulo, setTitulo] = useState(initial.titulo)
  const [cuerpo, setCuerpo] = useState(initial.cuerpo)
  const [color, setColor] = useState<PromoColor>(initial.color)
  const [scope, setScope] = useState<PromoScope>(initial.scope)
  const [ctaAction, setCtaAction] = useState<PromoCtaAction>(initial.cta_action)
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label ?? '')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }}>
      {/* PREVIEW EN VIVO */}
      <section
        style={{
          border: '1px solid #e5e5e5',
          padding: 20,
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#888',
            fontWeight: 700,
          }}
        >
          Preview en vivo
        </p>
        {titulo || cuerpo ? (
          <CatalogPromoBanner
            color={color}
            variant={scope === 'hero' ? 'hero' : 'inline'}
            eyebrow={titulo || 'Eyebrow'}
            body={cuerpo || 'Copy del banner'}
            actions={
              ctaAction !== 'none' && ctaLabel.trim()
                ? [{ label: ctaLabel.trim(), onClick: () => {} }]
                : undefined
            }
            animate={false}
          />
        ) : (
          <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 14 }}>
            Completá título y copy para ver el preview…
          </p>
        )}
      </section>

      {/* FORM */}
      <form
        action={formAction}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <Field label="Marca">
          <select name="marca_id" defaultValue={initial.marca_id} required>
            <option value="">— Elegí marca —</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Provincia" hint="Vacío = todas las provincias">
          <select name="provincia_id" defaultValue={initial.provincia_id ?? ''}>
            <option value="">Todas las provincias</option>
            {provincias.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Scope (dónde se renderiza)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SCOPES.map((s) => (
              <label key={s.value} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="scope"
                  value={s.value}
                  defaultChecked={initial.scope === s.value}
                  onChange={() => setScope(s.value)}
                />
                <span>
                  <strong>{s.label}</strong>
                  <br />
                  <small style={{ color: '#888' }}>{s.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <label
                key={c.value}
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  padding: '6px 10px',
                  border: `2px solid ${color === c.value ? c.swatch : '#e5e5e5'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="color"
                  value={c.value}
                  defaultChecked={initial.color === c.value}
                  onChange={() => setColor(c.value)}
                  style={{ accentColor: c.swatch }}
                />
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: c.swatch,
                    display: 'inline-block',
                  }}
                />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Eyebrow (uppercase, izquierda)">
          <input
            type="text"
            name="titulo"
            defaultValue={initial.titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            placeholder="Ej: CASA + LOTE"
          />
        </Field>

        <Field label="Copy (texto principal)">
          <input
            type="text"
            name="cuerpo"
            defaultValue={initial.cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
            placeholder="Ej: Tu casa, financiada — con o sin terreno propio."
          />
        </Field>

        <Field label="CTA Acción">
          <select
            name="cta_action"
            defaultValue={initial.cta_action}
            onChange={(e) => setCtaAction(e.target.value as PromoCtaAction)}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        {ctaAction !== 'none' && (
          <Field label="CTA Label (texto del botón)">
            <input
              type="text"
              name="cta_label"
              defaultValue={initial.cta_label ?? ''}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Ej: Quiero que me contacten"
            />
          </Field>
        )}

        <Field label="Sort order" hint="Menor = más arriba en su slot">
          <input
            type="number"
            name="sort_order"
            defaultValue={initial.sort_order}
            min={0}
            max={10000}
          />
        </Field>

        <Field label="Activo">
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              name="activo"
              defaultChecked={initial.activo}
            />
            <span>Banner visible en el catálogo público</span>
          </label>
        </Field>

        <Field label="Inicio (opcional)" hint="Si está vacío, aplica desde ya">
          <input
            type="datetime-local"
            name="starts_at"
            defaultValue={initial.starts_at?.slice(0, 16) ?? ''}
          />
        </Field>

        <Field label="Fin (opcional)" hint="Si está vacío, no caduca">
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={initial.ends_at?.slice(0, 16) ?? ''}
          />
        </Field>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <Link
            href="/admin/promos"
            style={{
              padding: '10px 22px',
              border: '1px solid #ddd',
              borderRadius: 999,
              textDecoration: 'none',
              color: '#555',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: '10px 28px',
              background: '#ff003d',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Guardando…' : submitLabel}
          </button>
        </div>

        {state.error && (
          <p
            style={{
              gridColumn: '1 / -1',
              padding: '10px 14px',
              background: '#fdecec',
              border: '1px solid #f3b9b9',
              borderRadius: 8,
              color: '#9a0e0e',
              fontSize: 13,
              margin: 0,
            }}
          >
            {state.error}
          </p>
        )}
      </form>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#888',
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>{hint}</p>
      )}
    </div>
  )
}
