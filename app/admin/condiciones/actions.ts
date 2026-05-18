'use server'

/**
 * app/admin/condiciones/actions.ts
 *
 * Upsert del bloque "Condiciones de Entrega" de CF (fila global,
 * marca_id NULL). Saneo del HTML al guardar (borde de seguridad, igual
 * que header/footer Fase 8). Writes vía service-role.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeRichTextOrNull } from '@/lib/sanitize'

type Result = { error: string | null }

export async function upsertDeliveryConditions(
  _prevState: Result,
  formData: FormData,
): Promise<Result> {
  const admin = createAdminClient()

  const statusRaw = String(formData.get('status') ?? 'active')
  const status = (['active', 'inactive', 'archived'].includes(statusRaw)
    ? statusRaw
    : 'active') as 'active' | 'inactive' | 'archived'

  const payload = {
    body: sanitizeRichTextOrNull(formData.get('body') as string | null),
    status,
  }

  const { data: existing } = await admin
    .from('delivery_conditions_content')
    .select('id')
    .is('marca_id', null)
    .maybeSingle()

  const { error } = existing
    ? await admin
        .from('delivery_conditions_content')
        .update(payload)
        .eq('id', existing.id)
    : await admin
        .from('delivery_conditions_content')
        .insert({ marca_id: null, ...payload })

  if (error) return { error: `Error al guardar: ${error.message}` }

  revalidatePath('/admin/condiciones')
  revalidatePath('/admin')
  revalidatePath('/')
  return { error: null }
}
