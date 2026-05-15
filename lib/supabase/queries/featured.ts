/**
 * lib/supabase/queries/featured.ts
 *
 * Devuelve los N modelos agrupados con `featured_rank` no null, ordenados
 * de menor a mayor (1 = más destacado). Para alimentar el mini marquee
 * del footer del catálogo.
 *
 * Reusa getGroupedCatalog y filtra/ordena en memoria para mantener una
 * sola query base — el catálogo no es lo suficientemente grande como para
 * justificar una query SQL separada con join + window function.
 *
 * `marcaId` opcional: si se pasa, solo featured de esa marca (catálogo de
 * marca / landing de marca). Sin él, featured de todas (agregador).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getGroupedCatalog, type CatalogModel } from './catalog_grouped'

export async function getFeaturedModels(
  supabase: SupabaseClient,
  limit = 8,
  marcaId?: string | null,
): Promise<CatalogModel[]> {
  const all = await getGroupedCatalog(supabase, marcaId ? { marcaId } : {})
  return all
    .filter((m) => m.featured_rank != null)
    .sort((a, b) => (a.featured_rank ?? 0) - (b.featured_rank ?? 0))
    .slice(0, limit)
}
