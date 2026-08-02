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
 *
 * ⚠️ X-01 (auditoría 2026-08-01): además devolvemos `token`, un HMAC de la identidad que
 * ACÁ resolvimos (ver `lib/auth/ximia-token.ts`). n8n verifica esa firma antes de tocar la
 * base y **descarta** el `user_id`/`email` crudos del body. Sin eso, el webhook público
 * entregaba el perfil de cualquier persona a quien POSTeara su mail.
 *
 * El token es lo ÚNICO que prueba identidad. Los campos sueltos siguen viajando por
 * compatibilidad con el n8n anterior durante el deploy en dos pasos (D-X01-4: primero CF,
 * después n8n); una vez que n8n exige el token, son decorativos.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentClient } from '@/lib/auth/get-current-client'
import { ximiaIdentityToken } from '@/lib/auth/ximia-token'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sb, client] = await Promise.all([createClient(), currentClient()])
  const { data: { user } } = await sb.auth.getUser()

  const identity = {
    user_id: user?.id ?? null,
    email: client?.email ?? user?.email ?? null,
  }

  return NextResponse.json({
    ...identity,
    source: client?.source ?? (user ? 'supabase' : null),
    token: ximiaIdentityToken(identity),
  })
}
