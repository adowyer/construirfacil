/**
 * GET /api/lead-session
 *
 * Devuelve el email del visitante si ya envió un lead (cookie cf_session).
 * Lo usan LeadForm y ReservarModal al montar para decidir si mostrar el
 * form o el success state ("Ya tenemos tus datos").
 *
 * Si no hay cookie válida → { email: null }.
 */

import { NextResponse } from 'next/server'
import { currentLeadEmail } from '@/lib/auth/get-current-client'

export async function GET() {
  const email = await currentLeadEmail()
  return NextResponse.json({ email })
}
