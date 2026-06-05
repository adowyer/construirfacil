/**
 * GET /api/client-status
 *
 * Devuelve el estado de identidad del visitante para decidir UI gating:
 *   - identified: true si tiene cookie cf_client (OTP/OAuth) o cf_session (lead)
 *   - source: cuál de las dos cookies validó (para futuras políticas de
 *     features de alto valor que exijan 'verified')
 *   - leadEmail: solo poblado si source='lead' (el LeadForm lo usa para
 *     mostrar success state "Ya tenemos tus datos")
 *
 * Lo consumen los hooks/componentes que gatean slides y CTAs del catálogo.
 */

import { NextResponse } from 'next/server'
import { currentClient } from '@/lib/auth/get-current-client'

export async function GET() {
  const session = await currentClient()
  return NextResponse.json({
    identified: !!session,
    source: session?.source ?? null,
    leadEmail: session?.source === 'lead' ? session.email : null,
  })
}
