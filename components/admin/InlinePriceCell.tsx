'use client'

/**
 * components/admin/InlinePriceCell.tsx
 *
 * Celda editable de un precio en el listado de modelos del admin. Guarda
 * automáticamente al perder foco (blur) si el valor cambió; al apretar Enter
 * confirma sin mover el foco. Estado optimista para que el usuario vea su
 * input mientras se persiste; al volver respuesta se reconcilia con el valor
 * normalizado del servidor (o se rollbackea si hay error).
 *
 * Vacío = NULL en DB. El input acepta formato es-AR (puntos de mil + coma
 * decimal) y formato simple — la action normaliza antes de guardar.
 */

import { useState, useTransition, useRef } from 'react'
import { updateModelPrice } from '@/app/admin/models/actions'

type PriceField =
  | 'precio_lista_usd'
  | 'precio_contado_usd'
  | 'precio_pozo_usd'

interface Props {
  modelId: string
  field: PriceField
  initial: number | null
}

function fmt(n: number | null): string {
  if (n == null) return ''
  // es-AR: punto mil, coma decimal. Sin decimales si es entero, sino máx 2.
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function InlinePriceCell({ modelId, field, initial }: Props) {
  const [display, setDisplay] = useState<string>(fmt(initial))
  const [committed, setCommitted] = useState<number | null>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    if (display === fmt(committed)) {
      setStatus('idle')
      return
    }
    setStatus('saving')
    setError(null)
    startTransition(async () => {
      const res = await updateModelPrice(modelId, field, display)
      if (res.error) {
        setError(res.error)
        setStatus('error')
        setDisplay(fmt(committed))
        return
      }
      setCommitted(res.value)
      setDisplay(fmt(res.value))
      setStatus('saved')
      window.setTimeout(() => setStatus('idle'), 1200)
    })
  }

  const borderColor =
    status === 'error'
      ? '#dc2626'
      : status === 'saved'
        ? '#16a34a'
        : '#E8E8E5'

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative inline-flex items-center">
        <span className="absolute left-2 text-[11px] text-neutral-400 select-none pointer-events-none">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => setDisplay(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              setDisplay(fmt(committed))
              setStatus('idle')
              setError(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          disabled={isPending}
          className="w-[110px] rounded-md pl-5 pr-2 py-1 text-xs text-right font-mono tabular-nums focus:outline-none focus:ring-1 transition-colors"
          style={{
            border: `1px solid ${borderColor}`,
            background: status === 'error' ? '#fef2f2' : '#fff',
          }}
          placeholder="—"
        />
      </div>
      {status === 'saving' && (
        <span className="text-[10px] text-neutral-400">…</span>
      )}
      {status === 'saved' && (
        <span className="text-[10px] text-green-600">✓</span>
      )}
      {status === 'error' && error && (
        <span
          className="text-[10px] text-red-600 cursor-help"
          title={error}
          aria-label={error}
        >
          !
        </span>
      )}
    </div>
  )
}
