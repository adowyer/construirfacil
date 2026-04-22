/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client for use in Client Components ('use client').
 * Creates a singleton per browser tab using @supabase/ssr's createBrowserClient.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *   const { data } = await supabase.from('house_models').select('*')
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
