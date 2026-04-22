/**
 * lib/supabase/queries/constructoras.ts
 *
 * Named query functions for constructoras.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Constructora } from '@/types/database'

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Fetch an approved constructora by slug for the public profile page.
 */
export async function getPublicConstructoraBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Constructora | null> {
  const { data, error } = await supabase
    .from('constructoras')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[getPublicConstructoraBySlug]', error?.message)
    }
    return null
  }

  return data
}

// ---------------------------------------------------------------------------
// Portal queries (owner — own constructora only)
// ---------------------------------------------------------------------------

/**
 * Fetch the constructora owned by the currently authenticated user.
 * Returns null if they haven't created one yet (triggers onboarding flow).
 */
export async function getMyConstructora(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<Constructora | null> {
  const { data, error } = await supabase
    .from('constructoras')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    console.error('[getMyConstructora]', error.message)
    return null
  }

  return data
}

// ---------------------------------------------------------------------------
// Admin queries
// ---------------------------------------------------------------------------

/**
 * Fetch all constructoras for the admin panel, pending first.
 */
export async function getAllConstructoras(
  supabase: SupabaseClient,
): Promise<Constructora[]> {
  const { data, error } = await supabase
    .from('constructoras')
    .select('*')
    .order('status', { ascending: true })     // 'approved' < 'pending' < 'rejected' alphabetically
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllConstructoras]', error.message)
    return []
  }

  // Re-sort: pending first, then approved, then rejected
  const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 }
  return (data ?? []).sort(
    (a: Constructora, b: Constructora) =>
      (order[a.status] ?? 99) - (order[b.status] ?? 99),
  )
}

/**
 * Fetch a single constructora by ID for admin review.
 */
export async function getConstructoraById(
  supabase: SupabaseClient,
  id: string,
): Promise<Constructora | null> {
  const { data, error } = await supabase
    .from('constructoras')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}
