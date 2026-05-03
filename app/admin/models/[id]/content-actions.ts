'use server'

/**
 * app/admin/models/[id]/content-actions.ts
 *
 * Server Action para guardar `model_content` (textos editoriales por modelo).
 * Una fila por (style_name, linea) — una sola entrada editorial sirve a
 * todas las variantes de un modelo bajo la misma línea.
 *
 * Ximia (agente IA) consume `agent_notes` y `lifestyle_tags` desde acá.
 *
 * Upsert por composite key UNIQUE(style_name, linea) declarado en 0005.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

function parseTags(value: FormDataEntryValue | null): string[] {
  // El form serializa el array como JSON en un input hidden.
  if (!value) return []
  try {
    const parsed = JSON.parse(String(value))
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0)
  } catch {
    return []
  }
}

type ContentResult = { error: string | null }

export async function saveModelContent(
  styleName: string,
  linea: string,
  modelId: string,  // para revalidar la page edit
  _prevState: ContentResult,
  formData: FormData,
): Promise<ContentResult> {
  if (!styleName || !linea) {
    return {
      error:
        'El modelo no tiene style_name o línea asignados — completalos en el form de arriba antes de cargar contenido editorial.',
    }
  }

  const admin = createAdminClient()

  const payload = {
    style_name: styleName,
    linea,
    tagline: parseOptionalText(formData.get('tagline')),
    body: parseOptionalText(formData.get('body')),
    estilo_label: parseOptionalText(formData.get('estilo_label')),
    lifestyle_tags: parseTags(formData.get('lifestyle_tags')),
    recommended_use: parseOptionalText(formData.get('recommended_use')),
    family_size_min: parseOptionalInt(formData.get('family_size_min')),
    family_size_max: parseOptionalInt(formData.get('family_size_max')),
    agent_notes: parseOptionalText(formData.get('agent_notes')),
  }

  const { error } = await admin
    .from('model_content')
    .upsert(payload, { onConflict: 'style_name,linea' })

  if (error) {
    return { error: `Error al guardar el contenido editorial: ${error.message}` }
  }

  // El catálogo público y el admin lo consumen.
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(`/admin/models/${modelId}`)

  return { error: null }
}
