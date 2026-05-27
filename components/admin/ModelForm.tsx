'use client'

/**
 * components/admin/ModelForm.tsx
 *
 * Form admin para crear/editar entradas en `house_catalog`.
 * Refleja el schema real (sku, style_name, variante, tipologia_code, precios
 * lista/contado/pozo, costo_plano_usd, etc.) e incluye selectores de Marca y
 * Línea. La línea se filtra por la marca elegida.
 *
 * El trigger sync_house_catalog_denorm sincroniza las columnas TEXT `brand`
 * y `linea` desde marca_id / linea_id, así que el form solo persiste las FKs.
 */

import { useActionState, useMemo, useState } from 'react'
import type { HouseCatalogRow } from '@/lib/supabase/queries/models'
import type { Marca } from '@/types/database'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import {
  Building2,
  Hash,
  Ruler,
  Bed,
  DollarSign,
  FileText,
  Activity,
  Save,
  Tag,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Section header (cuadrado rojo CF + título grande). Se renderea adentro de
// cada <section> antes del contenido. Reemplaza el <legend> antiguo del
// fieldset por algo más visible y consistente con el page header.
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Building2
  title: string
}) {
  return (
    <header className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100">
      <div className="w-11 h-11 rounded-xl bg-[#ff003d] text-white flex items-center justify-center shadow-sm shrink-0">
        <Icon className="w-[22px] h-[22px]" />
      </div>
      <h3 className="text-lg font-black text-neutral-900 tracking-tight uppercase">
        {title}
      </h3>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>

interface ModelFormProps {
  action: ActionFn
  marcas: Pick<Marca, 'id' | 'name'>[]
  lineas: Pick<LineaRow, 'id' | 'marca_id' | 'name' | 'sort_order'>[]
  /** id del <form>. Permite que inputs externos (ej: Atributos al final de
   *  la página) se sumen al submit con el atributo `form="..."`. */
  formId?: string
  defaultValues?: Partial<HouseCatalogRow>
  submitLabel?: string
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-widest text-neutral-400 mb-1"
    >
      {children}
      {hint && <span className="ml-2 normal-case tracking-normal text-neutral-300">{hint}</span>}
    </label>
  )
}

function TextInput({
  id,
  name,
  defaultValue,
  required,
  placeholder,
}: {
  id: string
  name: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      required={required}
      placeholder={placeholder}
      className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors"
    />
  )
}

function NumberInput({
  id,
  name,
  defaultValue,
  step,
  min,
  placeholder,
}: {
  id: string
  name: string
  defaultValue?: number | null
  step?: string
  min?: string
  placeholder?: string
}) {
  return (
    <input
      type="number"
      id={id}
      name={name}
      defaultValue={defaultValue ?? ''}
      step={step ?? 'any'}
      min={min}
      placeholder={placeholder}
      className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors"
    />
  )
}

function Checkbox({
  id,
  name,
  defaultChecked,
  label,
}: {
  id: string
  name: string
  defaultChecked?: boolean | null
  label: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-neutral-700 select-none cursor-pointer">
      <input
        type="checkbox"
        id={id}
        name={name}
        value="true"
        defaultChecked={!!defaultChecked}
        className="h-4 w-4 rounded border-neutral-300"
      />
      {label}
    </label>
  )
}

// Lista canónica de SCs del catálogo (matchea house_catalog.sistema_constructivo).
// Si un modelo trae un valor distinto, lo merge dinámicamente más abajo para
// no perder el value al re-guardar.
const SISTEMAS_CONSTRUCTIVOS = [
  'WOOD PLUS',
  'STEEL PLUS',
  'STONE PLUS',
] as const
const ESTILOS = ['', 'Moderno', 'Campestre', 'Nórdico', 'Industrial', 'Chalet', 'Mediterráneo', 'Clásico'] as const

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function ModelForm({
  action,
  marcas,
  lineas,
  formId,
  defaultValues,
  submitLabel = 'Guardar',
}: ModelFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: null })

  // Marca/Línea selección controlada (Línea depende de Marca)
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>(
    defaultValues?.marca_id ?? marcas[0]?.id ?? '',
  )

  const lineasForMarca = useMemo(
    () =>
      lineas
        .filter((l) => l.marca_id === selectedMarcaId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [lineas, selectedMarcaId],
  )

  return (
    <form id={formId} action={formAction} className="space-y-8">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}

      {/* ── Marca y Línea ─────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Building2} title="Marca y línea" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="marca_id">Marca *</Label>
            <select
              id="marca_id"
              name="marca_id"
              required
              value={selectedMarcaId}
              onChange={(e) => setSelectedMarcaId(e.target.value)}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            >
              {marcas.length === 0 && <option value="">— sin marcas cargadas —</option>}
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="linea_id">Línea</Label>
            <select
              id="linea_id"
              name="linea_id"
              defaultValue={defaultValues?.linea_id ?? ''}
              key={selectedMarcaId /* fuerza re-render del select al cambiar marca */}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            >
              <option value="">— sin línea —</option>
              {lineasForMarca.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Identificación ────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Hash} title="Identificación" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="sku" hint="único">
              SKU *
            </Label>
            <TextInput
              id="sku"
              name="sku"
              defaultValue={defaultValues?.sku}
              required
              placeholder="ej. BOSQUE-T2-V1-AMBAY-WF-72"
            />
          </div>
          <div>
            <Label htmlFor="style_name">Style name *</Label>
            <TextInput
              id="style_name"
              name="style_name"
              defaultValue={defaultValues?.style_name}
              required
              placeholder="ej. AMBAY"
            />
          </div>
          <div>
            <Label htmlFor="variante">Variante</Label>
            <TextInput
              id="variante"
              name="variante"
              defaultValue={defaultValues?.variante}
              placeholder="ej. 1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="tipologia_code">Tipología</Label>
            <TextInput
              id="tipologia_code"
              name="tipologia_code"
              defaultValue={defaultValues?.tipologia_code}
              placeholder="ej. 2"
            />
          </div>
          <div>
            <Label htmlFor="segmento">Segmento</Label>
            <TextInput
              id="segmento"
              name="segmento"
              defaultValue={defaultValues?.segmento}
              placeholder="ej. PREMIUM"
            />
          </div>
          <div>
            <Label htmlFor="estilo">Estilo</Label>
            <select
              id="estilo"
              name="estilo"
              defaultValue={defaultValues?.estilo ?? ''}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            >
              {ESTILOS.map((s) => (
                <option key={s || '__empty'} value={s}>
                  {s || '— sin estilo —'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Sistema constructivo + superficies ───────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Ruler} title="Sistema y superficies" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="sistema_constructivo">Sistema constructivo</Label>
            <select
              id="sistema_constructivo"
              name="sistema_constructivo"
              defaultValue={defaultValues?.sistema_constructivo ?? ''}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            >
              <option value="">— sin sistema —</option>
              {(() => {
                const current = defaultValues?.sistema_constructivo ?? ''
                const known = new Set<string>(SISTEMAS_CONSTRUCTIVOS as readonly string[])
                const all = [...SISTEMAS_CONSTRUCTIVOS as readonly string[]]
                // Si el modelo trae un SC que no está en la lista canónica,
                // lo agregamos para no perderlo al guardar.
                if (current && !known.has(current)) all.push(current)
                return all.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              })()}
            </select>
          </div>
          <div>
            <Label htmlFor="area_m2">Sup. cubierta (m²)</Label>
            <NumberInput
              id="area_m2"
              name="area_m2"
              defaultValue={defaultValues?.area_m2}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="area_semicubierta_m2">Sup. semicubierta (m²)</Label>
            <NumberInput
              id="area_semicubierta_m2"
              name="area_semicubierta_m2"
              defaultValue={defaultValues?.area_semicubierta_m2}
              step="0.01"
              min="0"
            />
          </div>
        </div>
      </section>

      {/* ── Programa funcional ───────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Bed} title="Programa" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="floors">Plantas</Label>
            <NumberInput
              id="floors"
              name="floors"
              defaultValue={defaultValues?.floors}
              step="1"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="bedrooms_label">Dorm. (label)</Label>
            <TextInput
              id="bedrooms_label"
              name="bedrooms_label"
              defaultValue={defaultValues?.bedrooms_label}
              placeholder="ej. 2-3"
            />
          </div>
          <div>
            <Label htmlFor="min_bedrooms">Dorm. mín.</Label>
            <NumberInput
              id="min_bedrooms"
              name="min_bedrooms"
              defaultValue={defaultValues?.min_bedrooms}
              step="1"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="max_bedrooms">Dorm. máx.</Label>
            <NumberInput
              id="max_bedrooms"
              name="max_bedrooms"
              defaultValue={defaultValues?.max_bedrooms}
              step="1"
              min="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="bathrooms">Baños</Label>
            <NumberInput
              id="bathrooms"
              name="bathrooms"
              defaultValue={defaultValues?.bathrooms}
              step="1"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="lavadero">Lavadero</Label>
            <TextInput
              id="lavadero"
              name="lavadero"
              defaultValue={defaultValues?.lavadero}
              placeholder="ej. Sí / No / Integrado"
            />
          </div>
          <div className="flex items-end gap-6 pb-2">
            <Checkbox
              id="toilette"
              name="toilette"
              defaultChecked={defaultValues?.toilette}
              label="Toilette"
            />
            <Checkbox
              id="parrilla"
              name="parrilla"
              defaultChecked={defaultValues?.parrilla}
              label="Parrilla"
            />
          </div>
        </div>
      </section>

      {/* ── Precios ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={DollarSign} title="Precios (USD)" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="precio_lista_usd">Precio lista</Label>
            <NumberInput
              id="precio_lista_usd"
              name="precio_lista_usd"
              defaultValue={defaultValues?.precio_lista_usd}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="precio_contado_usd">Precio contado</Label>
            <NumberInput
              id="precio_contado_usd"
              name="precio_contado_usd"
              defaultValue={defaultValues?.precio_contado_usd}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="precio_pozo_usd">Precio en pozo</Label>
            <NumberInput
              id="precio_pozo_usd"
              name="precio_pozo_usd"
              defaultValue={defaultValues?.precio_pozo_usd}
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="costo_plano_usd">Costo de plano</Label>
            <NumberInput
              id="costo_plano_usd"
              name="costo_plano_usd"
              defaultValue={defaultValues?.costo_plano_usd}
              step="0.01"
              min="0"
            />
          </div>
        </div>
      </section>

      {/* ── Contenido ────────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={FileText} title="Contenido" />
        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={defaultValues?.description ?? ''}
              rows={3}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brochure_url">Brochure URL</Label>
              <TextInput
                id="brochure_url"
                name="brochure_url"
                defaultValue={defaultValues?.brochure_url}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="pdf_url">PDF URL</Label>
              <TextInput
                id="pdf_url"
                name="pdf_url"
                defaultValue={defaultValues?.pdf_url}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Oferta ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Tag} title="Oferta" />
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_offer"
              defaultChecked={defaultValues?.is_offer ?? false}
              className="mt-0.5"
            />
            <span className="text-sm">
              <strong>Activar oferta</strong> — el catálogo muestra badge,
              precio con descuento y permite filtrar por "Ofertas".
            </span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="offer_pct">Descuento (%)</Label>
              <NumberInput
                id="offer_pct"
                name="offer_pct"
                defaultValue={defaultValues?.offer_pct}
                step="0.01"
                min="0"
                placeholder="10"
              />
            </div>
            <div>
              <Label htmlFor="offer_label">Etiqueta del badge</Label>
              <TextInput
                id="offer_label"
                name="offer_label"
                defaultValue={defaultValues?.offer_label}
                placeholder="Oferta · Liquidación · Lanzamiento"
              />
            </div>
            <div>
              <Label htmlFor="offer_until">Expira el</Label>
              <input
                id="offer_until"
                name="offer_until"
                type="date"
                defaultValue={defaultValues?.offer_until ?? ''}
                className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Si la fecha de expiración pasó, el catálogo público ignora la
            oferta automáticamente (no hace falta apagar el toggle a mano).
          </p>
        </div>
      </section>

      {/* ── Estado ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-[#E8E8E5] rounded-2xl p-7 shadow-sm">
        <SectionHeader icon={Activity} title="Estado" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Estado</Label>
            <select
              id="status"
              name="status"
              defaultValue={defaultValues?.status ?? 'active'}
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="featured_rank">Orden de relevancia</Label>
            <input
              id="featured_rank"
              name="featured_rank"
              type="number"
              min="1"
              step="1"
              defaultValue={defaultValues?.featured_rank ?? ''}
              placeholder="vacío = no destacado"
              className="w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors bg-white"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Menor = más destacado. Se aplica al grupo entero del modelo.
            </p>
          </div>
        </div>
      </section>

      {/* ── Submit (sticky bar al final del form) ────────────────────
           Atributos se renderea fuera del <form> en page.tsx (después de
           Imágenes), atado vía form="..." attribute. */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#FAFAF7] via-[#FAFAF7] to-transparent pt-6 pb-2 -mx-2 px-2">
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-neutral-400">
            {isPending ? 'Guardando cambios…' : 'Listos para guardar'}
          </span>
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
