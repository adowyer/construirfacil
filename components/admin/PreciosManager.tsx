'use client'

/**
 * components/admin/PreciosManager.tsx
 *
 * Dos herramientas sobre la marca elegida:
 *  A) Nombres de precio + cuál es el base (marca_price_slot).
 *  B) Import de precios por CSV: previsualizar (dry-run) → confirmar.
 *
 * El CSV se mantiene en estado (controlado) para que sobreviva al ciclo
 * previsualizar→confirmar. El plan se recalcula server-side al confirmar
 * (determinista) → lo que ves es lo que se aplica.
 */

import { useActionState, useMemo, useState, useTransition } from 'react'
import {
  previewOrImport,
  saveMarcaSlots,
  exportCurrentPricesCsv,
  type ImportState,
  type SlotsState,
} from '@/app/admin/precios/actions'
import type { MarcaPriceSlot } from '@/lib/supabase/queries/marca_price_slot'

const SLOT_KEYS = ['lista', 'contado', 'pozo'] as const
type SlotKey = (typeof SLOT_KEYS)[number]
const SLOT_FALLBACK: Record<SlotKey, string> = {
  lista: 'Lista',
  contado: 'Contado',
  pozo: 'Pozo',
}

const inputClass =
  'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'
const lbl = 'block text-[11px] uppercase tracking-widest text-neutral-400 mb-1'
const card = 'bg-white border border-[#E8E8E5] rounded-xl p-6'
const legend =
  'text-[11px] uppercase tracking-widest text-neutral-400 mb-4 font-semibold'

function fmt(n: number | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

export function PreciosManager({
  marcas,
  slotsByMarca,
  csvHeader,
}: {
  marcas: { id: string; name: string }[]
  slotsByMarca: Record<string, MarcaPriceSlot[]>
  csvHeader: string
}) {
  const [marcaId, setMarcaId] = useState(marcas[0]?.id ?? '')

  const slotState = useMemo(() => {
    const slots = slotsByMarca[marcaId] ?? []
    const byKey = new Map(slots.map((s) => [s.slot_key, s]))
    const base =
      slots.find((s) => s.is_base)?.slot_key ??
      ('lista' as MarcaPriceSlot['slot_key'])
    return SLOT_KEYS.map((k) => {
      const s = byKey.get(k)
      return {
        key: k,
        label: s?.label ?? SLOT_FALLBACK[k],
        enabled: s ? s.enabled : true,
        isBase: base === k,
      }
    })
  }, [slotsByMarca, marcaId])

  return (
    <div className="space-y-8">
      {/* Marca (compartida por las dos herramientas) */}
      <div className={card}>
        <label className={lbl} htmlFor="marca">
          Marca
        </label>
        <select
          id="marca"
          value={marcaId}
          onChange={(e) => setMarcaId(e.target.value)}
          className={inputClass}
        >
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <SlotEditor key={`slots-${marcaId}`} marcaId={marcaId} initial={slotState} />

      <ImportTool
        key={`imp-${marcaId}`}
        marcaId={marcaId}
        csvHeader={csvHeader}
      />
    </div>
  )
}

// ── A) Editor de slots ───────────────────────────────────────────────────────

function SlotEditor({
  marcaId,
  initial,
}: {
  marcaId: string
  initial: { key: SlotKey; label: string; enabled: boolean; isBase: boolean }[]
}) {
  const [state, formAction, isPending] = useActionState<SlotsState, FormData>(
    saveMarcaSlots,
    { error: null },
  )
  const defaultBase = initial.find((s) => s.isBase)?.key ?? 'lista'

  return (
    <form action={formAction} className={card}>
      <input type="hidden" name="marca_id" value={marcaId} />
      <p className={legend}>Nombres de precio y precio base</p>
      <p className="text-xs text-neutral-400 mb-5 -mt-2">
        El proveedor nombra sus precios como quiera. El{' '}
        <strong>base</strong> es el sugerido sobre el que el cotizador aplica
        los tramos. Deshabilitá los precios que esta marca no use.
      </p>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {state.error}
        </div>
      )}
      {state?.ok && !state.error && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg mb-4">
          Guardado.
        </div>
      )}

      <div className="space-y-3">
        {initial.map((s) => (
          <div
            key={s.key}
            className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-4 items-center border border-neutral-200 rounded-lg p-3"
          >
            <span className="text-xs font-mono text-neutral-400">
              {s.key}
            </span>
            <input
              name={`label__${s.key}`}
              defaultValue={s.label}
              placeholder={SLOT_FALLBACK[s.key]}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-sm text-neutral-700 whitespace-nowrap">
              <input
                type="radio"
                name="base_slot"
                value={s.key}
                defaultChecked={defaultBase === s.key}
                className="h-4 w-4 accent-[#ff003d]"
              />
              Base
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700 whitespace-nowrap">
              <input
                type="checkbox"
                name={`enabled__${s.key}`}
                defaultChecked={s.enabled}
                className="h-4 w-4 accent-[#ff003d]"
              />
              Habilitado
            </label>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-5">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar nombres'}
        </button>
      </div>
    </form>
  )
}

// ── B) Import de precios CSV ─────────────────────────────────────────────────

function ImportTool({
  marcaId,
  csvHeader,
}: {
  marcaId: string
  csvHeader: string
}) {
  const [state, formAction, isPending] = useActionState<ImportState, FormData>(
    previewOrImport,
    { error: null },
  )
  const [csv, setCsv] = useState('')
  const [previewedCsv, setPreviewedCsv] = useState<string | null>(null)
  const [downloading, startDownload] = useTransition()

  const plan = state.plan
  const applied = state.applied
  // El plan mostrado es válido para confirmar sólo si el CSV no cambió.
  const stale = previewedCsv !== null && previewedCsv !== csv
  const canConfirm =
    !!plan && plan.updates.length > 0 && !applied && !stale

  async function download() {
    startDownload(async () => {
      const { csv: data, error } = await exportCurrentPricesCsv(marcaId)
      if (error || !data) {
        alert(error ?? 'No se pudo exportar.')
        return
      }
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `precios-${marcaId}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  return (
    <div className={card}>
      <p className={legend}>Importar precios (CSV)</p>

      <div className="bg-neutral-50 border border-neutral-200 text-neutral-600 text-xs px-4 py-3 rounded-lg mb-4 space-y-1">
        <p>
          Header esperado:{' '}
          <code className="text-[11px] break-all">{csvHeader}</code>
        </p>
        <p>
          Clave de match: línea · estilo · tipología · variante · sistema
          constructivo. Sólo se escriben las columnas de precio presentes;
          una celda en blanco no borra el valor. Claves repetidas no se
          aplican (ambiguas).
        </p>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="underline text-[#ff003d] disabled:opacity-50"
        >
          {downloading
            ? 'Generando…'
            : 'Descargar precios actuales (plantilla)'}
        </button>
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="marca_id" value={marcaId} />
        <textarea
          name="csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder={csvHeader + '\nBOSQUE,LAPACHO,1,1,WOOD PLUS,238769,217063,176866'}
          className={`${inputClass} resize-y font-mono text-xs`}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            name="confirm"
            value="0"
            disabled={isPending}
            onClick={() => setPreviewedCsv(csv)}
            className="border border-neutral-300 text-neutral-700 px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:border-black hover:text-black transition-colors disabled:opacity-50"
          >
            {isPending ? 'Procesando…' : 'Previsualizar'}
          </button>
          {canConfirm && (
            <button
              type="submit"
              name="confirm"
              value="1"
              disabled={isPending}
              className="bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-sm font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors disabled:opacity-50"
            >
              {isPending
                ? 'Aplicando…'
                : `Confirmar e importar (${plan!.updates.length})`}
            </button>
          )}
          {stale && plan && !applied && (
            <span className="text-xs text-amber-600">
              El CSV cambió — volvé a previsualizar.
            </span>
          )}
        </div>
      </form>

      {applied && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-lg mt-5">
          Importado: <strong>{applied.updated}</strong> SKU actualizados
          {applied.failed > 0 && (
            <span className="text-red-700">
              {' '}
              · {applied.failed} con error
            </span>
          )}
          .
          {applied.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
              {applied.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <Stat n={plan.updates.length} label="A actualizar" accent />
            <Stat n={plan.unchanged} label="Sin cambios" />
            <Stat n={plan.unmatched.length} label="Sin match" />
            <Stat
              n={plan.invalid.length + plan.duplicates.length}
              label="Inválidas / dup."
            />
          </div>
          <p className="text-xs text-neutral-400">
            Precios en el CSV: {plan.priceColumnsPresent.join(', ')} ·{' '}
            {plan.dbRowsTotal} SKUs de la marca ·{' '}
            {plan.dbRowsNotInCsv} no mencionados (no se tocan).
          </p>

          {plan.updates.length > 0 && (
            <details open className="border border-neutral-200 rounded-lg">
              <summary className="px-4 py-2 text-sm font-semibold cursor-pointer">
                Cambios ({plan.updates.length})
              </summary>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-neutral-400 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Precio</th>
                      <th className="text-right px-3 py-2">Antes</th>
                      <th className="text-right px-3 py-2">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.updates.slice(0, 300).flatMap((u) =>
                      Object.entries(u.set).map(([slot, val]) => (
                        <tr
                          key={`${u.id}-${slot}`}
                          className="border-t border-neutral-100"
                        >
                          <td className="px-3 py-1.5">{u.label}</td>
                          <td className="px-3 py-1.5 font-mono">{slot}</td>
                          <td className="px-3 py-1.5 text-right text-neutral-400">
                            {fmt(
                              u.before[slot as keyof typeof u.before] as
                                | number
                                | undefined,
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold">
                            {fmt(val as number)}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
                {plan.updates.length > 300 && (
                  <p className="text-xs text-neutral-400 px-3 py-2">
                    +{plan.updates.length - 300} filas más (se aplican todas).
                  </p>
                )}
              </div>
            </details>
          )}

          {plan.unmatched.length > 0 && (
            <Issue title={`Sin match (${plan.unmatched.length})`} items={plan.unmatched} />
          )}
          {plan.duplicates.length > 0 && (
            <Issue
              title={`Claves repetidas — no se aplican (${plan.duplicates.length})`}
              items={plan.duplicates}
            />
          )}
          {plan.invalid.length > 0 && (
            <Issue
              title={`Filas inválidas (${plan.invalid.length})`}
              items={plan.invalid.map((i) => `Línea ${i.line}: ${i.reason}`)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Stat({
  n,
  label,
  accent,
}: {
  n: number
  label: string
  accent?: boolean
}) {
  return (
    <div className="border border-neutral-200 rounded-lg py-3">
      <div
        className={`text-2xl font-black ${accent ? 'text-[#ff003d]' : 'text-neutral-800'}`}
      >
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">
        {label}
      </div>
    </div>
  )
}

function Issue({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="border border-amber-200 bg-amber-50/50 rounded-lg">
      <summary className="px-4 py-2 text-sm font-semibold text-amber-800 cursor-pointer">
        {title}
      </summary>
      <ul className="max-h-60 overflow-auto px-5 py-2 list-disc text-xs text-amber-800 space-y-0.5">
        {items.slice(0, 200).map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </details>
  )
}
