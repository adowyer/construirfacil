/**
 * lib/supabase/admin.ts
 *
 * Service-role Supabase client. Bypasses Row-Level Security.
 * USE ONLY in trusted server-side code (Route Handlers, Server Actions).
 * NEVER import this in Client Components or expose to the browser.
 *
 * Typical use cases:
 *   - Admin approving / rejecting a constructora (status change requires
 *     writing fields the owner RLS policy doesn't allow)
 *   - Admin approving / rejecting a house model
 *   - Sending transactional emails triggered by status changes
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Ensure these are set in .env.local (server-side only).',
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
