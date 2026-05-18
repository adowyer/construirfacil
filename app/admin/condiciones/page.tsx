/**
 * app/admin/condiciones/page.tsx
 * Editor CF del bloque "Condiciones de Entrega" (fila global, marca_id NULL).
 * Se muestra en una modal desde el pill sobre la galería de cada modelo.
 */

import { createClient } from '@/lib/supabase/server'
import { getDeliveryConditionsGlobal } from '@/lib/supabase/queries/delivery_conditions'
import { DeliveryConditionsForm } from '@/components/admin/DeliveryConditionsForm'
import { upsertDeliveryConditions } from '@/app/admin/condiciones/actions'

export default async function AdminDeliveryConditionsPage() {
  const supabase = await createClient()
  const content = await getDeliveryConditionsGlobal(supabase)

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
        Condiciones de Entrega
      </h1>
      <p className="text-xs text-neutral-400 mb-10">
        Bloque editable que ve el cliente desde el pill “Condiciones de
        Entrega” sobre la galería de exterior de cada modelo. Es global a
        todas las casas (default de CF).
      </p>

      <DeliveryConditionsForm
        action={upsertDeliveryConditions}
        defaultValues={content}
      />
    </div>
  )
}
