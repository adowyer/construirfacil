/**
 * lib/supabase/server.ts
 *
 * Server-side Supabase client for use in:
 *   - React Server Components (RSC)
 *   - Route Handlers (app/api/...)
 *   - Server Actions
 *
 * Reads and writes session cookies via Next.js cookies() — requires
 * @supabase/ssr's createServerClient.
 *
 * Usage in a Server Component:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *
 * Usage in a Route Handler / Server Action:
 *   Same pattern — cookies() is available in both contexts.
 *
 * NEVER use this client on the browser side. The service role client
 * (admin operations that bypass RLS) lives in lib/supabase/admin.ts
 * and must only be called from trusted server code.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll is called from Server Components where cookies cannot be
            // written. The middleware handles session refresh, so this is safe
            // to ignore when the intent is a read-only RSC.
          }
        },
      },
    },
  )
}
