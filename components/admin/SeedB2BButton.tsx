'use client'

/**
 * components/admin/SeedB2BButton.tsx
 * Copia idempotente de la versión B2C → B2B (kinds/cards que falten en B2B).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { seedB2BFromB2C } from '@/app/admin/header/actions'

export function SeedB2BButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function handleSeed() {
    if (
      !confirm(
        'Copiar la versión B2C a B2B.\n\n' +
          'Solo se copian los slides/cards que falten en B2B (no pisa lo ya cargado). Los slides globales (pasos/principal) no se copian.',
      )
    )
      return

    setMsg(null)
    startTransition(async () => {
      const r = await seedB2BFromB2C()
      if (r.error) setMsg({ ok: false, text: r.error })
      else {
        setMsg({ ok: true, text: 'B2B sembrado desde B2C.' })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleSeed}
        disabled={isPending}
        className="text-xs text-neutral-700 border border-neutral-300 px-[27px] py-[5px] rounded-full hover:bg-neutral-100 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Sembrando…' : 'Sembrar B2B desde B2C'}
      </button>
      {msg && (
        <p
          className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}
