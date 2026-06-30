/**
 * lib/supabase/queries/operative-provincias.ts
 *
 * Devuelve el set de provincia_ids donde NINGUNA marca recommendable opera
 * — las "no operativas". El caller (que tiene la lista total) calcula el
 * complemento si necesita las "operativas".
 *
 * Definición de "no operativa":
 *   TODAS las marcas (status='approved' AND recommendable=true) están
 *   excluidas en esa provincia por una regla general en marca_zonas
 *   (linea_id=null AND sistema_constructivo=null AND excluded=true).
 *   Overrides por línea/SC no cuentan como exclusión total — la marca
 *   sigue operando aunque limite alguna línea.
 *
 * Por defecto una marca opera en TODA Argentina salvo excepción explícita.
 * Si no hay marcas approved+recommendable → todas son "no operativas".
 *
 * Cache: 5 min + tags 'marcas' + 'marca_zonas' (admin puede mutarlos).
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const getNonOperativeProvinciaIds = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient()

    const [marcasRes, zonasRes] = await Promise.all([
      supabase
        .from('marcas')
        .select('id')
        .eq('status', 'approved')
        .eq('recommendable', true),
      supabase
        .from('marca_zonas')
        .select('marca_id, provincia_id')
        .eq('status', 'active')
        .eq('excluded', true)
        .is('linea_id', null)
        .is('sistema_constructivo', null),
    ])

    if (marcasRes.error) {
      console.error('[operative-provincias] marcas:', marcasRes.error.message)
      return []
    }
    if (zonasRes.error) {
      console.error('[operative-provincias] zonas:', zonasRes.error.message)
      return []
    }

    const marcas = (marcasRes.data ?? []) as { id: string }[]
    if (marcas.length === 0) {
      // Sin marcas recommendable, técnicamente ninguna provincia es operativa,
      // pero retornar [] mantiene el contrato (caller no destaca nada).
      return []
    }

    // Para cada provincia, set de marcas excluidas.
    const excludedByProvincia = new Map<string, Set<string>>()
    for (const z of (zonasRes.data ?? []) as {
      marca_id: string
      provincia_id: string
    }[]) {
      let s = excludedByProvincia.get(z.provincia_id)
      if (!s) {
        s = new Set()
        excludedByProvincia.set(z.provincia_id, s)
      }
      s.add(z.marca_id)
    }

    // Una provincia es "no operativa" si TODAS las marcas recommendable
    // la tienen excluida (excludedMarcaIds.size === totalMarcas).
    const totalMarcas = marcas.length
    const nonOperative: string[] = []
    for (const [provinciaId, excludedMarcaIds] of excludedByProvincia) {
      if (excludedMarcaIds.size >= totalMarcas) nonOperative.push(provinciaId)
    }
    return nonOperative
  },
  ['non-operative-provincias'],
  {
    revalidate: 60 * 5, // 5 min — admin puede mutar marca_zonas o recommendable
    tags: ['marcas', 'marca_zonas'],
  },
)
