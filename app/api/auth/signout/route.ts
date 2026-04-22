/**
 * app/api/auth/signout/route.ts
 * POST handler for signing out. Called from the portal and admin nav sign-out buttons.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
