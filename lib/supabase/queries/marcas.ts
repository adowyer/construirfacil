/**
 * lib/supabase/queries/marcas.ts
 *
 * Named query functions for marcas.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Marca } from '@/types/database'

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Fetch an approved marca by slug for the public profile page.
 */
export async function getPublicMarcaBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Marca | null> {
  const { data, error } = await supabase
    .from('marcas')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[getPublicMarcaBySlug]', error?.message)
    }
    return null
  }

  return data
}

// ---------------------------------------------------------------------------
// Portal queries (owner — own marca only)
// ---------------------------------------------------------------------------

/**
 * Fetch the marca owned by the currently authenticated user.
 * Returns null if they haven't created one yet (triggers onboarding flow).
 */
export async function getMyMarca(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<Marca | null> {
  const { data, error } = await supabase
    .from('marcas')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    console.error('[getMyMarca]', error.message)
    return null
  }

  return data
}

// ---------------------------------------------------------------------------
// Admin queries
// ---------------------------------------------------------------------------

/**
 * Fetch all marcas for the admin panel, pending first.
 */
export async function getAllMarcas(
  supabase: SupabaseClient,
): Promise<Marca[]> {
  const { data, error } = await supabase
    .from('marcas')
    .select('*')
    .order('status', { ascending: true })     // 'approved' < 'pending' < 'rejected' alphabetically
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllMarcas]', error.message)
    return []
  }

  // Re-sort: pending first, then approved, then rejected
  const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 }
  return (data ?? []).sort(
    (a: Marca, b: Marca) =>
      (order[a.status] ?? 99) - (order[b.status] ?? 99),
  )
}

/**
 * Fetch a single marca by ID for admin review.
 */
export async function getMarcaById(
  supabase: SupabaseClient,
  id: string,
): Promise<Marca | null> {
  const { data, error } = await supabase
    .from('marcas')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}
