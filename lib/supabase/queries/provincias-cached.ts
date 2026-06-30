/**
 * lib/supabase/queries/provincias-cached.ts
 *
 * Versión cacheada de getAllProvincias. La lista de provincias es un seed
 * fijo de 24 jurisdicciones (CABA + 23 provincias) que solo cambia con una
 * migración manual del founder.
 *
 * Estrategia: `unstable_cache` con TTL de 24h + tag "provincias" para
 * invalidación explícita. Usa el admin client (lectura trivial, sin cookies)
 * porque cachear un cliente scoped a cookies del request actual cruzaría
 * contextos de usuario.
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllProvincias } from '@/lib/supabase/queries/zones'

export const getProvinciasCached = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    return getAllProvincias(supabase)
  },
  ['provincias'],
  {
    revalidate: 60 * 60 * 24, // 24h — el seed casi nunca cambia
    tags: ['provincias'],
  },
)
