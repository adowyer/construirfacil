/**
 * GET /api/ximia/identity
 *
 * Devuelve los PIVOTES de identidad que el widget de Ximia manda a n8n.
 * No enriquece (name/phone) — el contrato del agente prevé que n8n haga
 * `select name, phone, email from public.users where id = $user_id::uuid
 * or email = $email`. Acá solo combinamos las dos fuentes que tenemos del
 * lado web:
 *
 *   1. Sesión Supabase (auth.users.id)        → `user_id` (uuid)
 *   2. Cookie cf_client / cf_session firmada  → `email`
 *
 * Ambas pueden coexistir, ninguna o solo una. Devolvemos todo lo que haya;
 * n8n hace el JOIN. Anónimo total = ambos null.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentClient } from '@/lib/auth/get-current-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sb, client] = await Promise.all([createClient(), currentClient()])
  const { data: { user } } = await sb.auth.getUser()

  return NextResponse.json({
    user_id: user?.id ?? null,
    email: client?.email ?? user?.email ?? null,
    source: client?.source ?? (user ? 'supabase' : null),
  })
}
