'use server'

/**
 * app/admin/cotizador/actions.ts
 *
 * Guarda los 3 tramos + la config (T.C. de referencia + caveat). Writes
 * service-role. El caveat se rendea como HTML en el sitio → se sanea.
 * Sin T.C. → usd_ars_ref NULL → la cuota DEGRADA en el catálogo (a
 * propósito: nunca un peso inventado).
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeRichTextOrNull } from '@/lib/sanitize'

type Result = { error: string | null; ok?: boolean }

function optText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function optNum(v: FormDataEntryValue | null): number | null {
  const s = optText(v)
  if (s === null) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function numOr0(v: FormDataEntryValue | null): number {
  return optNum(v) ?? 0
}

export async function saveCotizador(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  // ── Tramos ──────────────────────────────────────────────────────────
  const ids = String(formData.get('tier_ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const id of ids) {
    const label = optText(formData.get(`label__${id}`))
    if (!label) return { error: 'Cada tramo necesita un nombre.' }
    const { error } = await admin
      .from('pricing_tiers')
      .update({
        label,
        lead_time_label: optText(formData.get(`lead__${id}`)),
        price_modifier_pct: numOr0(formData.get(`mod__${id}`)),
        highlighted: formData.get(`hl__${id}`) === 'on',
        active: formData.get(`active__${id}`) === 'on',
      })
      .eq('id', id)
    if (error) return { error: `Error al guardar el tramo: ${error.message}` }
  }

  // ── Config (singleton id=1) ─────────────────────────────────────────
  const { error: cfgErr } = await admin.from('pricing_config').upsert(
    {
      id: 1,
      usd_ars_ref: optNum(formData.get('usd_ars_ref')),
      fx_ref_date: optText(formData.get('fx_ref_date')),
      caveat_html: sanitizeRichTextOrNull(
        optText(formData.get('caveat_html')),
      ),
    },
    { onConflict: 'id' },
  )
  if (cfgErr) return { error: `Error al guardar la config: ${cfgErr.message}` }

  revalidatePath('/admin/cotizador')
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/empresas')
  return { error: null, ok: true }
}
